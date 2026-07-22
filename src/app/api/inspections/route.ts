import { getSession, requirePermission } from '@/server/auth/session';
import { createPrismaInspectionPort } from '@/server/adapters/prisma-inspection-port';
import {
  submitInspection,
  type InspectionPayload,
} from '@/server/services/submit-inspection';
import {
  inspectionPayloadSchema,
  mutationEnvelopeSchema,
} from '@/server/dto/schemas';
import type { MutationEnvelope } from '@/domain/sync/envelope';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/inspections — submit a completed inspection (doc 04 sync + doc 08).
 * Requires `workorder:submit`. The untrusted body is parsed with Zod, then the
 * pure submit-inspection service runs against the Prisma port (idempotent on the
 * envelope mutationId). 201 on first apply, 200 on idempotent replay.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaInspectionPort();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = requirePermission(await getSession(req), 'workorder:submit');

    const raw: unknown = await req.json();
    const env = mutationEnvelopeSchema.parse(raw);
    const payload = inspectionPayloadSchema.parse(env.payload);

    const envelope: MutationEnvelope<InspectionPayload> = {
      mutationId: env.mutationId,
      deviceId: env.deviceId,
      entity: env.entity,
      action: env.action,
      baseVersion: env.baseVersion,
      clientOccurredAt: env.clientOccurredAt,
      payloadChecksum: env.payloadChecksum,
      payload,
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
