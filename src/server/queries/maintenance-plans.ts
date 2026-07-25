import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Read query for active maintenance plans (doc 08). Feeds the Planner's
 * schedule-batch creation form — each batch is generated from exactly one plan.
 */
export interface MaintenancePlanRow {
  id: string;
  name: string;
  kind: string;
  assetTypeKey: string;
  frequency: string;
}

export async function listActivePlans(
  client: PrismaClient = defaultPrisma,
): Promise<MaintenancePlanRow[]> {
  return client.maintenancePlan.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, kind: true, assetTypeKey: true, frequency: true },
  });
}
