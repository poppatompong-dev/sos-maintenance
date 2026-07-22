import type { PrismaClient, WorkOrderStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Read query for the work-order list (doc 08 §Interface). Optional filters by
 * status and asset code. Newest first.
 */
export interface WorkOrderListRow {
  code: string;
  kind: string;
  status: string;
  assetCode: string;
  dueAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
}

export interface ListWorkOrdersFilter {
  status?: WorkOrderStatus;
  assetCode?: string;
}

export async function listWorkOrders(
  filter: ListWorkOrdersFilter = {},
  client: PrismaClient = defaultPrisma,
): Promise<WorkOrderListRow[]> {
  const rows = await client.workOrder.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assetCode ? { asset: { code: filter.assetCode } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      code: true,
      kind: true,
      status: true,
      dueAt: true,
      scheduledFor: true,
      createdAt: true,
      asset: { select: { code: true } },
    },
  });
  return rows.map((w) => ({
    code: w.code,
    kind: w.kind,
    status: w.status,
    assetCode: w.asset.code,
    dueAt: w.dueAt,
    scheduledFor: w.scheduledFor,
    createdAt: w.createdAt,
  }));
}
