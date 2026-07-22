import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import type {
  FaultForRepair,
  PersistRepairInput,
  RepairPort,
} from '../services/record-repair';

/**
 * Prisma adapter for the repair/retest service. Writes the RepairAction and
 * advances the fault status in one transaction.
 */
export function createPrismaRepairPort(
  client: PrismaClient = defaultPrisma,
): RepairPort {
  return {
    async loadFaultByCode(code: string): Promise<FaultForRepair | null> {
      const f = await client.fault.findUnique({
        where: { code },
        select: { id: true, code: true, status: true, assetId: true },
      });
      return f ?? null;
    },

    async workOrderExists(workOrderId: string): Promise<boolean> {
      const wo = await client.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true },
      });
      return wo !== null;
    },

    async persistRepair(input: PersistRepairInput): Promise<void> {
      await client.$transaction(async (tx) => {
        await tx.repairAction.create({
          data: {
            faultId: input.faultId,
            workOrderId: input.workOrderId,
            cause: input.cause,
            fixDescription: input.fixDescription,
            changedParts: input.changedParts ?? null,
            retestPassed: input.retestPassed,
            retestNote: input.retestNote ?? null,
          },
        });
        await tx.fault.update({
          where: { id: input.faultId },
          data: {
            status: input.newFaultStatus,
            resolvedAt: input.newFaultStatus === 'RESOLVED' ? input.now : null,
            version: { increment: 1 },
          },
        });
      });
    },
  };
}
