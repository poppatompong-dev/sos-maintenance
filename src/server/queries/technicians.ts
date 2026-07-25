import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

export interface TechnicianOption {
  id: string;
  displayName: string;
}

/** Active technicians a Planner can assign a work order to — real people only, never invented. */
export async function listActiveTechnicians(
  client: PrismaClient = defaultPrisma,
): Promise<TechnicianOption[]> {
  const rows = await client.user.findMany({
    where: { active: true, roles: { has: 'TECHNICIAN' } },
    orderBy: { displayName: 'asc' },
    select: { id: true, displayName: true },
  });
  return rows;
}
