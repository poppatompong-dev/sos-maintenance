import { z } from 'zod';

/**
 * API validation schemas (Zod). Route handlers parse untrusted input with these
 * before anything reaches a service; parsed types flow into the domain.
 */
export const gpsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const responseResultSchema = z.enum(['PASS', 'FAIL', 'NA', 'UNKNOWN']);

export const evaluatedResponseSchema = z.object({
  itemCode: z.string().min(1),
  label: z.string().min(1),
  result: responseResultSchema,
  criticality: z.enum(['CRITICAL', 'NON_CRITICAL']),
  criticalFunctionKey: z.string().optional(),
});

export const attachmentManifestItemSchema = z.object({
  name: z.string().min(1),
  checksumSha256: z.string().min(1),
  storageKey: z.string().optional(),
});

export const inspectionPayloadSchema = z.object({
  workOrderId: z.string().min(1),
  responses: z.array(evaluatedResponseSchema).min(1),
  gps: gpsSchema,
});

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

export type InspectionPayload = z.infer<typeof inspectionPayloadSchema>;
export type GpsInput = z.infer<typeof gpsSchema>;
