import { getSession, requirePermission } from '@/server/auth/session';
import { createPrismaInspectionPort } from '@/server/adapters/prisma-inspection-port';
import {
  submitInspection,
  InspectionError,
  type InspectionPayload,
} from '@/server/services/submit-inspection';
import {
  fieldInspectionPayloadSchema,
  mutationEnvelopeSchema,
} from '@/server/dto/schemas';
import { canonicalizeFieldSubmission } from '@/domain/checklist';
import { loadPinnedChecklistDefinition } from '@/server/queries/checklist-definition';
import type { MutationEnvelope } from '@/domain/sync/envelope';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/inspections — submit a completed monthly field inspection as GROUP
 * OUTCOMES (doc 04 sync + doc 08). Requires `workorder:submit`. The untrusted
 * body is Zod-parsed; the server loads the work order's pinned version and
 * canonicalizes group outcomes into per-item responses (criticality/function
 * keys read from item definitions, never the wire), then runs the pure
 * submit-inspection service (idempotent on the envelope mutationId). 201 on first
 * apply, 200 on idempotent replay.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaInspectionPort();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = requirePermission(await getSession(req), 'workorder:submit');

    const raw: unknown = await req.json();
    const env = mutationEnvelopeSchema.parse(raw);
    const payload = fieldInspectionPayloadSchema.parse(env.payload);

    const def = await loadPinnedChecklistDefinition(payload.workOrderId);
    if (!def) {
      throw new InspectionError('WORKORDER_NOT_FOUND', 'ไม่พบใบงานหรือเวอร์ชันเช็คลิสต์');
    }
    if (def.groups.length === 0) {
      throw new InspectionError(
        'NO_FIELD_GROUPS',
        'ใบงานนี้ผูกกับเวอร์ชันที่ยังไม่มีกลุ่มภาคสนาม กรุณาออกใบงานใหม่ภายใต้เวอร์ชันปัจจุบัน',
      );
    }

    const responses = canonicalizeFieldSubmission({
      groups: def.groups.map((g) => ({
        key: g.key,
        required: g.required,
        memberItemCodes: g.members.map((m) => m.memberKey),
      })),
      items: def.items.map((it) => ({
        code: it.code,
        label: it.label,
        criticality: it.criticality,
        criticalFunctionKey: it.criticalFunctionKey,
      })),
      generalNoteItemCode: def.generalNoteItemCode ?? '',
      submission: { groups: payload.groups, generalNote: payload.generalNote },
    });

    const envelope: MutationEnvelope<InspectionPayload> = {
      mutationId: env.mutationId,
      deviceId: env.deviceId,
      entity: env.entity,
      action: env.action,
      baseVersion: env.baseVersion,
      clientOccurredAt: env.clientOccurredAt,
      payloadChecksum: env.payloadChecksum,
      payload: { workOrderId: payload.workOrderId, responses, gps: payload.gps },
      attachments: env.attachments,
    };

    const result = await submitInspection(port, {
      envelope,
      actor: session,
      now: new Date(),
    });

    return json(result, result.idempotentReplay ? 200 : 201);
  } catch (err) {
    return errorResponse(err);
  }
}
