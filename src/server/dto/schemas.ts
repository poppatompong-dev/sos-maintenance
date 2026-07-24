import { z } from 'zod';

/**
 * API validation schemas (Zod). Route handlers parse untrusted input with these
 * before anything reaches a service; parsed types flow into the domain.
 */
export const gpsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const attachmentManifestItemSchema = z.object({
  name: z.string().min(1),
  checksumSha256: z.string().min(1),
  storageKey: z.string().optional(),
});

export const groupOutcomeSchema = z.enum(['NORMAL', 'PROBLEM', 'UNTESTABLE']);
export const memberStateSchema = z.enum(['OK', 'PROBLEM', 'UNTESTED']);

export const submittedMemberSchema = z.object({
  memberKey: z.string().min(1),
  state: memberStateSchema,
});

export const submittedGroupSchema = z.object({
  groupKey: z.string().min(1),
  outcome: groupOutcomeSchema,
  members: z.array(submittedMemberSchema).optional(),
  note: z.string().optional(),
  reason: z.string().optional(),
});

export const fieldInspectionPayloadSchema = z
  .object({
    workOrderId: z.string().min(1),
    groups: z.array(submittedGroupSchema).min(1),
    generalNote: z.string().optional(),
    gps: gpsSchema,
  })
  .superRefine((val, ctx) => {
    // Reject duplicate group keys across the payload and duplicate member keys
    // within a group (defence in depth alongside the domain canonicalizer).
    const groupKeys = new Set<string>();
    for (const g of val.groups) {
      if (groupKeys.has(g.groupKey)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups'], message: `duplicate groupKey: ${g.groupKey}` });
      }
      groupKeys.add(g.groupKey);
      const memberKeys = new Set<string>();
      for (const m of g.members ?? []) {
        if (memberKeys.has(m.memberKey)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups'], message: `duplicate memberKey: ${m.memberKey}` });
        }
        memberKeys.add(m.memberKey);
      }
    }
  });

export type FieldInspectionPayload = z.infer<typeof fieldInspectionPayloadSchema>;

export const mutationEnvelopeSchema = z.object({
  mutationId: z.string().uuid(),
  deviceId: z.string().min(1),
  entity: z.string().min(1),
  action: z.enum(['create', 'update']),
  baseVersion: z.number().int().nullable(),
  clientOccurredAt: z.string().datetime(),
  payloadChecksum: z.string().min(1),
  payload: z.unknown(),
  attachments: z.array(attachmentManifestItemSchema).optional(),
});

export type GpsInput = z.infer<typeof gpsSchema>;
