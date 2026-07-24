-- CreateEnum
CREATE TYPE "ChecklistVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ChecklistReasonPolicy" AS ENUM ('STANDARD');

-- CreateEnum
CREATE TYPE "ChecklistPhotoPolicy" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- AlterTable
ALTER TABLE "checklist_template_version" ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "status" "ChecklistVersionStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "checklist_item" ADD COLUMN     "fieldGroupId" UUID,
ADD COLUMN     "memberOrder" INTEGER;

-- CreateTable
CREATE TABLE "checklist_field_group" (
    "id" UUID NOT NULL,
    "checklistVersionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "reasonPolicy" "ChecklistReasonPolicy" NOT NULL DEFAULT 'STANDARD',
    "photoPolicy" "ChecklistPhotoPolicy" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_field_group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_field_group_checklistVersionId_idx" ON "checklist_field_group"("checklistVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_field_group_checklistVersionId_key_key" ON "checklist_field_group"("checklistVersionId", "key");

-- CreateIndex
CREATE INDEX "checklist_item_fieldGroupId_idx" ON "checklist_item"("fieldGroupId");

-- AddForeignKey
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_fieldGroupId_fkey" FOREIGN KEY ("fieldGroupId") REFERENCES "checklist_field_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_field_group" ADD CONSTRAINT "checklist_field_group_checklistVersionId_fkey" FOREIGN KEY ("checklistVersionId") REFERENCES "checklist_template_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy classification (design §Migration): every pre-existing checklist version
-- is frozen as PUBLISHED so nothing legacy is silently left editable. On a fresh
-- database this affects zero rows; seed.ts creates fresh versions already frozen.
UPDATE "checklist_template_version" SET "status" = 'PUBLISHED', "isLocked" = true;
