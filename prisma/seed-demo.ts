// prisma/seed-demo.ts
//
// CLI entry point for `pnpm db:seed:demo`. Validates the environment FIRST with
// the pure guard; only if it passes does it construct a Prisma client, create the
// idempotent fixture, report the demo code, and disconnect. Fails closed with a
// non-zero exit and a safe message (no connection string) on any guard failure.

import { PrismaClient } from '@prisma/client';
import { evaluateDemoGuard } from './demo-fixture-guard';
import { createDemoFixture, DEMO_WORK_ORDER_CODE } from './demo-fixture';

async function main(): Promise<void> {
  const guard = evaluateDemoGuard(process.env);
  if (!guard.ok) {
    console.error(`✖ Local demo seed refused. ${guard.reason}`);
    process.exit(1);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await createDemoFixture(prisma);
    console.log(
      `✔ Demo work order ${result.workOrderCode} on ${result.assetCode} ` +
        `is ${result.status} (${result.created ? 'created' : 'already present'}).`,
    );
    console.log(`  Open /today to start it. Demo code: ${DEMO_WORK_ORDER_CODE}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('✖ Demo seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
