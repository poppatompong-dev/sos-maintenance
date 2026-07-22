-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "AssetLifecycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('READY', 'WATCH', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('CRITICAL', 'NON_CRITICAL');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('OK', 'DEGRADED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MaintenanceKind" AS ENUM ('INITIAL_SURVEY', 'WEEKLY_CENTER', 'MONTHLY_FIELD', 'SEMIANNUAL_DEEP', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'SEMIANNUAL');

-- CreateEnum
CREATE TYPE "ChecklistItemKind" AS ENUM ('BOOLEAN_PASS_FAIL', 'NUMBER', 'TEXT', 'PHOTO', 'SELECT');

-- CreateEnum
CREATE TYPE "ResponseResult" AS ENUM ('PASS', 'FAIL', 'NA', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScheduleBatchStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'CLOSED', 'REJECTED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FaultStatus" AS ENUM ('OPEN', 'IN_REPAIR', 'RETEST', 'RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HealthSource" AS ENUM ('MANUAL', 'IMPORT', 'ADAPTER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'PARSED', 'PREVIEWED', 'VALIDATED', 'COMMITTED', 'ROLLED_BACK', 'FAILED');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('SYSTEM_ADMIN', 'PLANNER', 'TECHNICIAN', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "ReadinessTrigger" AS ENUM ('CHECKLIST_SUBMIT', 'FAULT_OPENED', 'FAULT_RESOLVED', 'REPAIR_ACCEPTED', 'RECONCILIATION', 'BASELINE_APPROVED', 'IMPORT');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "keycloakId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "roles" "AppRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_type" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadataSchema" JSONB,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "navigationNote" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetTypeId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "qrToken" TEXT NOT NULL,
    "lifecycle" "AssetLifecycleStatus" NOT NULL DEFAULT 'PLANNED',
    "orgUnit" TEXT,
    "typeData" JSONB,
    "baselineApproved" BOOLEAN NOT NULL DEFAULT false,
    "baselineApprovedAt" TIMESTAMP(3),
    "baselineApproverId" UUID,
    "currentReadiness" "ReadinessStatus" NOT NULL DEFAULT 'UNKNOWN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_component" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial" TEXT,
    "installedAt" TIMESTAMP(3),
    "criticality" "Criticality" NOT NULL DEFAULT 'NON_CRITICAL',
    "status" "ComponentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_version" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_template_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "ChecklistItemKind" NOT NULL DEFAULT 'BOOLEAN_PASS_FAIL',
    "criticality" "Criticality" NOT NULL DEFAULT 'NON_CRITICAL',
    "criticalFunctionKey" TEXT,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,

    CONSTRAINT "checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "assetTypeKey" TEXT NOT NULL,
    "checklistVersionId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_batch" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ScheduleBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "approverId" UUID,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "assetId" UUID NOT NULL,
    "planId" UUID,
    "scheduleBatchId" UUID,
    "checklistVersionId" UUID,
    "faultId" UUID,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "temporaryMeasureAt" TIMESTAMP(3),
    "repairedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_response" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "checklistVersionId" UUID NOT NULL,
    "result" "ResponseResult" NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "note" TEXT,
    "capturedLat" DOUBLE PRECISION,
    "capturedLng" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "locationException" BOOLEAN NOT NULL DEFAULT false,
    "locationReason" TEXT,
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "clientMutationId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fault" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "assetId" UUID NOT NULL,
    "originWorkOrderId" UUID,
    "severity" "Criticality" NOT NULL,
    "status" "FaultStatus" NOT NULL DEFAULT 'OPEN',
    "symptom" TEXT NOT NULL,
    "sourceRef" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_action" (
    "id" UUID NOT NULL,
    "faultId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "cause" TEXT NOT NULL,
    "fixDescription" TEXT NOT NULL,
    "changedParts" TEXT,
    "retestPassed" BOOLEAN,
    "retestNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "checklistResponseId" UUID,
    "repairActionId" UUID,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "phase" TEXT,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_observation" (
    "id" UUID NOT NULL,
    "assetId" UUID,
    "externalAssetKey" TEXT,
    "sourceId" UUID,
    "importBatchId" UUID,
    "source" "HealthSource" NOT NULL,
    "overallStatus" "HealthStatus" NOT NULL,
    "componentKey" TEXT,
    "componentStatus" "HealthStatus",
    "observedAt" TIMESTAMP(3) NOT NULL,
    "rawChecksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_snapshot" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "status" "ReadinessStatus" NOT NULL,
    "reasons" JSONB NOT NULL,
    "trigger" "ReadinessTrigger" NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_source" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" UUID NOT NULL,
    "sourceId" UUID,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileChecksum" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "rowErrors" JSONB,
    "actorId" UUID,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "device" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_keycloakId_key" ON "app_user"("keycloakId");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_username_key" ON "app_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "asset_type_key_key" ON "asset_type"("key");

-- CreateIndex
CREATE UNIQUE INDEX "location_code_key" ON "location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_code_key" ON "asset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_qrToken_key" ON "asset"("qrToken");

-- CreateIndex
CREATE INDEX "asset_assetTypeId_idx" ON "asset"("assetTypeId");

-- CreateIndex
CREATE INDEX "asset_locationId_idx" ON "asset"("locationId");

-- CreateIndex
CREATE INDEX "asset_component_assetId_idx" ON "asset_component"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_component_assetId_key_key" ON "asset_component"("assetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_template_key_key" ON "checklist_template"("key");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_template_version_templateId_version_key" ON "checklist_template_version"("templateId", "version");

-- CreateIndex
CREATE INDEX "checklist_item_versionId_idx" ON "checklist_item"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_item_versionId_code_key" ON "checklist_item"("versionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_plan_kind_assetTypeKey_key" ON "maintenance_plan"("kind", "assetTypeKey");

-- CreateIndex
CREATE INDEX "schedule_batch_planId_idx" ON "schedule_batch"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_code_key" ON "work_order"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_faultId_key" ON "work_order"("faultId");

-- CreateIndex
CREATE INDEX "work_order_assetId_idx" ON "work_order"("assetId");

-- CreateIndex
CREATE INDEX "work_order_status_idx" ON "work_order"("status");

-- CreateIndex
CREATE INDEX "assignment_userId_idx" ON "assignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_workOrderId_userId_key" ON "assignment"("workOrderId", "userId");

-- CreateIndex
CREATE INDEX "work_log_workOrderId_idx" ON "work_log"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_response_clientMutationId_key" ON "checklist_response"("clientMutationId");

-- CreateIndex
CREATE INDEX "checklist_response_workOrderId_idx" ON "checklist_response"("workOrderId");

-- CreateIndex
CREATE INDEX "checklist_response_itemId_idx" ON "checklist_response"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "fault_code_key" ON "fault"("code");

-- CreateIndex
CREATE INDEX "fault_assetId_idx" ON "fault"("assetId");

-- CreateIndex
CREATE INDEX "fault_status_idx" ON "fault"("status");

-- CreateIndex
CREATE INDEX "repair_action_faultId_idx" ON "repair_action"("faultId");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_storageKey_key" ON "attachment"("storageKey");

-- CreateIndex
CREATE INDEX "attachment_entityType_entityId_idx" ON "attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "health_observation_assetId_idx" ON "health_observation"("assetId");

-- CreateIndex
CREATE INDEX "health_observation_observedAt_idx" ON "health_observation"("observedAt");

-- CreateIndex
CREATE INDEX "readiness_snapshot_assetId_computedAt_idx" ON "readiness_snapshot"("assetId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_idempotencyKey_key" ON "notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notification_status_idx" ON "notification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_source_key_key" ON "integration_source"("key");

-- CreateIndex
CREATE INDEX "audit_event_entityType_entityId_idx" ON "audit_event"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_event_occurredAt_idx" ON "audit_event"("occurredAt");

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "asset_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_baselineApproverId_fkey" FOREIGN KEY ("baselineApproverId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_component" ADD CONSTRAINT "asset_component_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_version" ADD CONSTRAINT "checklist_template_version_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "checklist_template_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plan" ADD CONSTRAINT "maintenance_plan_checklistVersionId_fkey" FOREIGN KEY ("checklistVersionId") REFERENCES "checklist_template_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_batch" ADD CONSTRAINT "schedule_batch_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_batch" ADD CONSTRAINT "schedule_batch_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_scheduleBatchId_fkey" FOREIGN KEY ("scheduleBatchId") REFERENCES "schedule_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_checklistVersionId_fkey" FOREIGN KEY ("checklistVersionId") REFERENCES "checklist_template_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_faultId_fkey" FOREIGN KEY ("faultId") REFERENCES "fault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_response" ADD CONSTRAINT "checklist_response_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_response" ADD CONSTRAINT "checklist_response_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "checklist_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_response" ADD CONSTRAINT "checklist_response_checklistVersionId_fkey" FOREIGN KEY ("checklistVersionId") REFERENCES "checklist_template_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fault" ADD CONSTRAINT "fault_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fault" ADD CONSTRAINT "fault_originWorkOrderId_fkey" FOREIGN KEY ("originWorkOrderId") REFERENCES "work_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_action" ADD CONSTRAINT "repair_action_faultId_fkey" FOREIGN KEY ("faultId") REFERENCES "fault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_action" ADD CONSTRAINT "repair_action_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_checklistResponseId_fkey" FOREIGN KEY ("checklistResponseId") REFERENCES "checklist_response"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_repairActionId_fkey" FOREIGN KEY ("repairActionId") REFERENCES "repair_action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_observation" ADD CONSTRAINT "health_observation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_observation" ADD CONSTRAINT "health_observation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "integration_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_observation" ADD CONSTRAINT "health_observation_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_snapshot" ADD CONSTRAINT "readiness_snapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "integration_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
