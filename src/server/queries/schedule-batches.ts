import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Read query for the schedule-batch list (doc 08). Newest first, with the
 * generated work-order count so the Planner sees the size of each round.
 */
export interface ScheduleBatchListRow {
  id: string;
  name: string;
  status: string;
  planKind: string;
  planName: string;
  workOrderCount: number;
  createdAt: Date;
  approvedAt: Date | null;
  publishedAt: Date | null;
}

export async function listScheduleBatches(
  client: PrismaClient = defaultPrisma,
): Promise<ScheduleBatchListRow[]> {
  const rows = await client.scheduleBatch.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      publishedAt: true,
      plan: { select: { kind: true, name: true } },
      _count: { select: { workOrders: true } },
    },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    planKind: b.plan.kind,
    planName: b.plan.name,
    workOrderCount: b._count.workOrders,
    createdAt: b.createdAt,
    approvedAt: b.approvedAt,
    publishedAt: b.publishedAt,
  }));
}
