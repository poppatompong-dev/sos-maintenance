import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

export interface AttachmentMeta {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

/** Metadata needed to stream an attachment back through the authorized download route. */
export async function getAttachmentMeta(
  id: string,
  client: PrismaClient = defaultPrisma,
): Promise<AttachmentMeta | null> {
  return client.attachment.findUnique({
    where: { id },
    select: { id: true, storageKey: true, mimeType: true, sizeBytes: true },
  });
}
