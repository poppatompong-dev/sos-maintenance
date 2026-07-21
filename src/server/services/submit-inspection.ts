import { assertCan } from '../../domain/authz/policy';
import type { AppRole } from '../../domain/work/types';
import {
  toCriticalCheckResults,
  type EvaluatedResponse,
} from '../../domain/checklist';
import { evaluateGpsCapture, type GpsEvaluation } from '../../domain/geo';
import { deriveFaults, hasCriticalFault, type DerivedFault } from '../../domain/fault';
import { evaluateReadiness, type ReadinessResult } from '../../domain/readiness';
import { validateEnvelope, type MutationEnvelope } from '../../domain/sync/envelope';

/**
 * Application service: submit a completed inspection. This is a real vertical
 * slice — it composes RBAC, envelope idempotency, the GPS rule, the checklist→
 * readiness pipeline and fault derivation with NO framework or DB coupling. The
 * persistence port is injected, so it is fully testable with an in-memory adapter.
 */

export interface AssetForInspection {
  assetId: string;
  code: string;
  lat: number;
  lng: number;
  baselineApproved: boolean;
  requiredCriticalFunctions: { key: string; label: string }[];
  nextDueAt: Date | null;
  /** Pre-existing open non-critical issue on the asset. */
  openNonCriticalIssue: boolean;
}

export interface PersistInspectionInput {
  mutationId: string;
  workOrderId: string;
  assetId: string;
  responses: EvaluatedResponse[];
  gps: GpsEvaluation & { lat: number; lng: number };
  readiness: ReadinessResult;
  faults: DerivedFault[];
}

/** Port the service depends on (implemented by Prisma in prod, in-memory in tests). */
export interface InspectionPort {
  isMutationProcessed(mutationId: string): Promise<boolean>;
  loadAssetForWorkOrder(workOrderId: string): Promise<AssetForInspection | null>;
  persist(input: PersistInspectionInput): Promise<void>;
}

export interface InspectionPayload {
  workOrderId: string;
  responses: EvaluatedResponse[];
  gps: { lat: number; lng: number };
}

export interface SubmitInspectionCommand {
  envelope: MutationEnvelope<InspectionPayload>;
  actor: { userId: string; roles: AppRole[] };
  now: Date;
  gpsThresholdMeters?: number;
}

export interface SubmitInspectionResult {
  idempotentReplay: boolean;
  readiness?: ReadinessResult;
  gps?: GpsEvaluation;
  faults?: DerivedFault[];
}

export class InspectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'InspectionError';
    this.code = code;
  }
}

export async function submitInspection(
  port: InspectionPort,
  cmd: SubmitInspectionCommand,
): Promise<SubmitInspectionResult> {
  // 1. Authorization (server-side).
  assertCan(cmd.actor.roles, 'workorder:submit');

  // 2. Envelope structural validation.
  const v = validateEnvelope(cmd.envelope);
  if (!v.valid) {
    throw new InspectionError('INVALID_ENVELOPE', v.errors.join('; '));
  }

  // 3. Idempotency — a retry of the same mutation is a no-op replay.
  if (await port.isMutationProcessed(cmd.envelope.mutationId)) {
    return { idempotentReplay: true };
  }

  const payload = cmd.envelope.payload;

  // 4. Load the asset context.
  const asset = await port.loadAssetForWorkOrder(payload.workOrderId);
  if (!asset) {
    throw new InspectionError('ASSET_NOT_FOUND', 'ไม่พบทรัพย์สินสำหรับใบงานนี้');
  }

  // 5. GPS rule (>100 m ⇒ reason + review flag; still recorded).
  const gps = evaluateGpsCapture(
    { lat: asset.lat, lng: asset.lng },
    payload.gps,
    cmd.gpsThresholdMeters,
  );

  // 6. Faults from failed items.
  const faults = deriveFaults(payload.workOrderId, payload.responses);
  const openNonCriticalIssue =
    asset.openNonCriticalIssue ||
    faults.some((f) => f.severity === 'NON_CRITICAL');

  // 7. Checklist → critical results → readiness.
  const criticalChecks = toCriticalCheckResults(
    payload.responses,
    asset.requiredCriticalFunctions,
  );
  const readiness = evaluateReadiness({
    now: cmd.now,
    baselineApproved: asset.baselineApproved,
    criticalChecks,
    openCriticalFault: hasCriticalFault(faults),
    openNonCriticalIssue,
    nextDueAt: asset.nextDueAt,
  });

  // 8. Persist atomically (adapter's responsibility).
  await port.persist({
    mutationId: cmd.envelope.mutationId,
    workOrderId: payload.workOrderId,
    assetId: asset.assetId,
    responses: payload.responses,
    gps: { ...gps, lat: payload.gps.lat, lng: payload.gps.lng },
    readiness,
    faults,
  });

  return { idempotentReplay: false, readiness, gps, faults };
}
