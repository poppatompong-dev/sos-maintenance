import type { PrismaClient } from '@prisma/client';
import type { CriticalCheckResult, AssetReadinessFacts } from '@/domain/readiness';

const OPEN_FAULT_STATUSES = ['OPEN', 'IN_REPAIR', 'RETEST', 'REOPENED'] as const;

/** Work-order states that still expect to be worked (for "next due"). */
const LIVE_WORK_ORDER_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'REJECTED',
  'REOPENED',
] as const;

function toCriticalChecks(
  required: { key: string; label: string }[],
  latestByKey: Map<string, { result: string; observedAt: Date }>,
): CriticalCheckResult[] {
  return required.map((fn) => {
    const latest = latestByKey.get(fn.key);
    const result =
      latest?.result === 'PASS' || latest?.result === 'FAIL'
        ? (latest.result as 'PASS' | 'FAIL')
        : 'UNKNOWN';
    return {
      key: fn.key,
      label: fn.label,
      result,
      observedAt: latest?.observedAt ?? null,
    };
  });
}

export async function loadAssetReadinessFacts(
  client: PrismaClient,
  assetId: string,
  requiredComponents: { key: string; name: string }[],
): Promise<AssetReadinessFacts> {
  const required = requiredComponents.map((c) => ({ key: c.key, label: c.name }));

  const latestByKey = new Map<string, { result: string; observedAt: Date }>();
  if (required.length > 0) {
    const responses = await client.checklistResponse.findMany({
      where: {
        workOrder: { assetId },
        item: { criticalFunctionKey: { in: required.map((r) => r.key) } },
      },
      orderBy: { observedAt: 'desc' },
      select: {
        result: true,
        observedAt: true,
        item: { select: { criticalFunctionKey: true } },
      },
    });
    for (const r of responses) {
      const key = r.item.criticalFunctionKey;
      if (key && !latestByKey.has(key)) {
        latestByKey.set(key, { result: r.result, observedAt: r.observedAt });
      }
    }
  }

  const faults = await client.fault.findMany({
    where: {
      assetId,
      status: { in: [...OPEN_FAULT_STATUSES] },
    },
    select: { severity: true },
  });

  const nextDue = await client.workOrder.findFirst({
    where: {
      assetId,
      status: { in: [...LIVE_WORK_ORDER_STATUSES] },
      dueAt: { not: null },
    },
    orderBy: { dueAt: 'asc' },
    select: { dueAt: true },
  });

  return {
    criticalChecks: toCriticalChecks(required, latestByKey),
    openCriticalFault: faults.some((f) => f.severity === 'CRITICAL'),
    openNonCriticalIssue: faults.some((f) => f.severity === 'NON_CRITICAL'),
    nextDueAt: nextDue?.dueAt ?? null,
  };
}
