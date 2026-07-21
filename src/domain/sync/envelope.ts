/**
 * Offline mutation envelope + conflict handling (doc 04, ADR 0004). Every offline
 * write carries a client-generated `mutationId` so retries are idempotent, and a
 * `baseVersion` for optimistic concurrency. Conflicts are surfaced — NEVER a
 * silent last-write-wins.
 */
export interface AttachmentManifestItem {
  name: string;
  checksumSha256: string;
  storageKey?: string;
}

export interface MutationEnvelope<TPayload = unknown> {
  mutationId: string; // client UUID — idempotency key
  deviceId: string;
  entity: string; // e.g. 'checklist_response'
  action: 'create' | 'update';
  baseVersion: number | null;
  clientOccurredAt: string; // ISO instant
  payloadChecksum: string;
  payload: TPayload;
  attachments?: AttachmentManifestItem[];
}

export interface EnvelopeValidation {
  valid: boolean;
  errors: string[];
}

/** Structural validation independent of the DTO/zod layer (defence in depth). */
export function validateEnvelope(env: MutationEnvelope): EnvelopeValidation {
  const errors: string[] = [];
  if (!env.mutationId?.trim()) errors.push('mutationId ว่าง');
  if (!env.deviceId?.trim()) errors.push('deviceId ว่าง');
  if (!env.entity?.trim()) errors.push('entity ว่าง');
  if (env.action !== 'create' && env.action !== 'update')
    errors.push('action ไม่ถูกต้อง');
  if (!env.payloadChecksum?.trim()) errors.push('payloadChecksum ว่าง');
  if (Number.isNaN(Date.parse(env.clientOccurredAt)))
    errors.push('clientOccurredAt ไม่ใช่เวลา ISO');
  return { valid: errors.length === 0, errors };
}

/** Idempotency check: has this mutation already been applied? */
export function isDuplicateMutation(
  mutationId: string,
  processed: ReadonlySet<string>,
): boolean {
  return processed.has(mutationId);
}

export interface ConflictResult {
  conflict: boolean;
  baseVersion: number | null;
  serverVersion: number;
}

/**
 * Optimistic-concurrency check. A conflict occurs when the client's baseVersion
 * doesn't match the current server version. The caller must return both versions
 * to the client for resolution (no silent overwrite). A null baseVersion (fresh
 * create) never conflicts.
 */
export function detectVersionConflict(
  baseVersion: number | null,
  serverVersion: number,
): ConflictResult {
  const conflict = baseVersion !== null && baseVersion !== serverVersion;
  return { conflict, baseVersion, serverVersion };
}
