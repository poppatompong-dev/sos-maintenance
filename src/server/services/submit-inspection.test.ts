import { describe, expect, it } from 'vitest';
import {
  submitInspection,
  InspectionError,
  type AssetForInspection,
  type InspectionPort,
  type PersistInspectionInput,
  type SubmitInspectionCommand,
} from './submit-inspection';
import { ForbiddenError } from '../../domain/authz/policy';
import { CRITICAL_FUNCTIONS } from '../../domain/readiness/critical-functions';
import type { EvaluatedResponse } from '../../domain/checklist';
import type { MutationEnvelope } from '../../domain/sync/envelope';

const required = CRITICAL_FUNCTIONS.map((c) => ({ key: c.key, label: c.label }));

const ASSET: AssetForInspection = {
  assetId: 'asset-ep06',
  code: 'EP06',
  lat: 15.701,
  lng: 100.130916666667,
  baselineApproved: true,
  requiredCriticalFunctions: required,
  nextDueAt: new Date('2026-08-21T02:00:00.000Z'),
  openNonCriticalIssue: false,
};

/** In-memory adapter — the whole point is DB-free testability of the slice. */
class InMemoryPort implements InspectionPort {
  processed = new Set<string>();
  persisted: PersistInspectionInput[] = [];
  constructor(private asset: AssetForInspection | null = ASSET) {}
  async isMutationProcessed(id: string) {
    return this.processed.has(id);
  }
  async loadAssetForWorkOrder() {
    return this.asset;
  }
  async persist(input: PersistInspectionInput) {
    this.processed.add(input.mutationId);
    this.persisted.push(input);
  }
}

const passing: EvaluatedResponse[] = CRITICAL_FUNCTIONS.map((c) => ({
  itemCode: `m_${c.key}`,
  label: `ทดสอบ${c.label}`,
  result: 'PASS',
  criticality: 'CRITICAL',
  criticalFunctionKey: c.key,
}));

function command(
  over: Partial<{
    responses: EvaluatedResponse[];
    gps: { lat: number; lng: number; reason?: string };
    roles: SubmitInspectionCommand['actor']['roles'];
    mutationId: string;
  }> = {},
): SubmitInspectionCommand {
  const envelope: MutationEnvelope<{
    workOrderId: string;
    responses: EvaluatedResponse[];
    gps: { lat: number; lng: number; reason?: string };
  }> = {
    mutationId: over.mutationId ?? '22222222-2222-4222-8222-222222222222',
    deviceId: 'device-1',
    entity: 'checklist_response',
    action: 'create',
    baseVersion: null,
    clientOccurredAt: '2026-07-21T03:00:00.000Z',
    payloadChecksum: 'chk',
    payload: {
      workOrderId: 'wo-ep06',
      responses: over.responses ?? passing,
      gps: over.gps ?? { lat: ASSET.lat, lng: ASSET.lng },
    },
  };
  return {
    envelope,
    actor: { userId: 'tech-1', roles: over.roles ?? ['TECHNICIAN'] },
    now: new Date('2026-07-21T03:05:00.000Z'),
  };
}

describe('submitInspection (vertical slice)', () => {
  it('a passing submission ⇒ READY, no faults, persisted once', async () => {
    const port = new InMemoryPort();
    const r = await submitInspection(port, command());
    expect(r.idempotentReplay).toBe(false);
    expect(r.readiness?.status).toBe('READY');
    expect(r.faults).toHaveLength(0);
    expect(port.persisted).toHaveLength(1);
  });

  it('a failed critical audio check ⇒ DOWN + 1 critical fault', async () => {
    const responses = passing.map((r) =>
      r.criticalFunctionKey === 'speaker_two_way_audio'
        ? { ...r, result: 'FAIL' as const }
        : r,
    );
    const port = new InMemoryPort();
    const r = await submitInspection(port, command({ responses }));
    expect(r.readiness?.status).toBe('DOWN');
    expect(r.faults?.some((f) => f.severity === 'CRITICAL')).toBe(true);
  });

  it('rejects an item requiring a photo when no photo attachment is provided (UI-03)', async () => {
    const responses: EvaluatedResponse[] = [
      ...passing,
      {
        itemCode: 'i_survey_pole_photo',
        label: 'ภาพถ่ายโครงสร้างเสาโดยรวม',
        result: 'PASS',
        criticality: 'NON_CRITICAL',
        requiresPhoto: true,
        attachmentIds: [],
      },
    ];
    const port = new InMemoryPort();
    await expect(submitInspection(port, command({ responses }))).rejects.toMatchObject({
      code: 'PHOTO_REQUIRED',
    });
    expect(port.persisted).toHaveLength(0);
  });

  it('accepts an item requiring a photo when photo attachmentId is present (UI-03)', async () => {
    const responses: EvaluatedResponse[] = [
      ...passing,
      {
        itemCode: 'i_survey_pole_photo',
        label: 'ภาพถ่ายโครงสร้างเสาโดยรวม',
        result: 'PASS',
        criticality: 'NON_CRITICAL',
        requiresPhoto: true,
        attachmentIds: ['att-123-uuid'],
      },
    ];
    const port = new InMemoryPort();
    const r = await submitInspection(port, command({ responses }));
    expect(r.idempotentReplay).toBe(false);
    expect(port.persisted).toHaveLength(1);
  });

  it('GPS beyond 100 m WITH a reason is still recorded and flagged', async () => {
    // ~1 km north
    const gps = { lat: ASSET.lat + 0.01, lng: ASSET.lng, reason: 'ป้ายจุดตรวจถูกบดบัง ต้องยืนห่างจากเสา' };
    const port = new InMemoryPort();
    const r = await submitInspection(port, command({ gps }));
    expect(r.gps?.isException).toBe(true);
    expect(r.gps?.requiresReason).toBe(true);
    expect(port.persisted[0].gps.reviewFlag).toBe(true);
    expect(port.persisted[0].gps.reason).toBe(gps.reason);
  });

  it('GPS beyond 100 m WITHOUT a reason is rejected before persisting', async () => {
    // ~1 km north, no reason supplied
    const gps = { lat: ASSET.lat + 0.01, lng: ASSET.lng };
    const port = new InMemoryPort();
    await expect(submitInspection(port, command({ gps }))).rejects.toMatchObject({
      code: 'GPS_REASON_REQUIRED',
    });
    expect(port.persisted).toHaveLength(0);
  });

  it('GPS beyond 100 m with a whitespace-only reason is rejected', async () => {
    const gps = { lat: ASSET.lat + 0.01, lng: ASSET.lng, reason: '   ' };
    const port = new InMemoryPort();
    await expect(submitInspection(port, command({ gps }))).rejects.toMatchObject({
      code: 'GPS_REASON_REQUIRED',
    });
    expect(port.persisted).toHaveLength(0);
  });

  it('GPS within 100 m never requires a reason', async () => {
    const port = new InMemoryPort();
    const r = await submitInspection(port, command()); // default gps == asset location
    expect(r.gps?.requiresReason).toBe(false);
    expect(port.persisted[0].gps.reason).toBeUndefined();
  });

  it('is idempotent — replaying the same mutationId does not persist twice', async () => {
    const port = new InMemoryPort();
    await submitInspection(port, command());
    const replay = await submitInspection(port, command());
    expect(replay.idempotentReplay).toBe(true);
    expect(port.persisted).toHaveLength(1);
  });

  it('rejects an actor without submit permission', async () => {
    const port = new InMemoryPort();
    await expect(
      submitInspection(port, command({ roles: ['EXECUTIVE'] })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('errors clearly when the asset is missing', async () => {
    const port = new InMemoryPort(null);
    await expect(submitInspection(port, command())).rejects.toBeInstanceOf(
      InspectionError,
    );
  });
});
