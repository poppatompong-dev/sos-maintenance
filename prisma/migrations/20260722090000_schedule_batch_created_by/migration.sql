-- AlterTable
ALTER TABLE "schedule_batch" ADD COLUMN     "createdById" UUID;

-- AddForeignKey
ALTER TABLE "schedule_batch" ADD CONSTRAINT "schedule_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
