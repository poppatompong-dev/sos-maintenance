// prisma/checklist-v2-cli.ts
import { PrismaClient } from '@prisma/client';
import { rolloutMonthlyV2 } from './checklist-v2';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { versionId, created } = await rolloutMonthlyV2(prisma);
    console.log(
      `✔ Monthly checklist v2 ${created ? 'created,' : 'already present,'} published and plan repointed (version ${versionId}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('✖ checklist-v2 rollout failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
