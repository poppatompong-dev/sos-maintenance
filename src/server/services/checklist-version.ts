import { ChecklistVersionStatus, type PrismaClient } from '@prisma/client';
import { validateChecklistVersionForPublish } from '../../domain/checklist';

/** Errors from checklist-version lifecycle operations (mapped to HTTP by callers). */
export class ChecklistVersionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ChecklistVersionError';
    this.code = code;
  }
}

/**
 * Validate a DRAFT version and freeze it as PUBLISHED. Runs the pure publish
 * validation over the loaded groups/items; throws with the first errors on
 * failure. `requiredCriticalFunctionKeys` is what readiness expects for this kind.
 */
export async function publishChecklistVersion(
  prisma: PrismaClient,
  versionId: string,
  requiredCriticalFunctionKeys: string[],
): Promise<void> {
  const version = await prisma.checklistTemplateVersion.findUnique({
    where: { id: versionId },
    select: {
      status: true,
      items: { select: { code: true, label: true, criticalFunctionKey: true } },
      fieldGroups: {
        orderBy: { order: 'asc' },
        select: {
          key: true,
          label: true,
          order: true,
          required: true,
          reasonPolicy: true,
          photoPolicy: true,
          // Select each member item's OWN versionId for the factual same-version check.
          members: { orderBy: { memberOrder: 'asc' }, select: { code: true, label: true, versionId: true } },
        },
      },
    },
  });
  if (!version) throw new ChecklistVersionError('VERSION_NOT_FOUND', 'ไม่พบเวอร์ชันเช็คลิสต์');
  if (version.status === ChecklistVersionStatus.RETIRED) {
    throw new ChecklistVersionError('VERSION_RETIRED', 'เวอร์ชันนี้ถูกเลิกใช้แล้ว ไม่สามารถเผยแพร่ซ้ำได้');
  }
  if (version.status === ChecklistVersionStatus.PUBLISHED) return; // idempotent; never mutates a frozen version

  const result = validateChecklistVersionForPublish({
    versionId,
    requiredCriticalFunctionKeys,
    // version.items is the relation of THIS version, so each item's versionId === versionId.
    items: version.items.map((i) => ({ versionId, code: i.code, label: i.label, criticalFunctionKey: i.criticalFunctionKey })),
    groups: version.fieldGroups.map((g) => ({
      key: g.key,
      label: g.label,
      order: g.order,
      required: g.required,
      reasonPolicy: g.reasonPolicy,
      photoPolicy: g.photoPolicy,
      members: g.members.map((m) => ({ itemCode: m.code, label: m.label, itemVersionId: m.versionId })),
    })),
  });
  if (!result.ok) {
    throw new ChecklistVersionError('PUBLISH_VALIDATION_FAILED', result.errors.join('; '));
  }

  await prisma.checklistTemplateVersion.update({
    where: { id: versionId },
    data: { status: ChecklistVersionStatus.PUBLISHED, isLocked: true, publishedAt: new Date() },
  });
}

/**
 * Repoint a plan to a version — allowed only if that version is PUBLISHED AND its
 * template is the same maintenance kind as the plan (a monthly plan can never be
 * pointed at a weekly version, etc.).
 */
export async function repointPlanToVersion(
  prisma: PrismaClient,
  planId: string,
  versionId: string,
): Promise<void> {
  const [plan, version] = await Promise.all([
    prisma.maintenancePlan.findUnique({ where: { id: planId }, select: { kind: true } }),
    prisma.checklistTemplateVersion.findUnique({
      where: { id: versionId },
      select: { status: true, template: { select: { kind: true } } },
    }),
  ]);
  if (!plan) throw new ChecklistVersionError('PLAN_NOT_FOUND', 'ไม่พบแผนบำรุงรักษา');
  if (!version) throw new ChecklistVersionError('VERSION_NOT_FOUND', 'ไม่พบเวอร์ชันเช็คลิสต์');
  if (version.status !== ChecklistVersionStatus.PUBLISHED) {
    throw new ChecklistVersionError('NOT_PUBLISHED', 'อ้างอิงได้เฉพาะเวอร์ชันที่เผยแพร่แล้ว');
  }
  if (version.template.kind !== plan.kind) {
    throw new ChecklistVersionError('KIND_MISMATCH', 'เวอร์ชันเช็คลิสต์ไม่ตรงกับประเภทงานของแผน');
  }
  await prisma.maintenancePlan.update({
    where: { id: planId },
    data: { checklistVersionId: versionId },
  });
}

/** Retire a version — stops NEW references; never alters content. */
export async function retireChecklistVersion(
  prisma: PrismaClient,
  versionId: string,
): Promise<void> {
  const activePlans = await prisma.maintenancePlan.count({
    where: { checklistVersionId: versionId, active: true },
  });
  if (activePlans > 0) {
    throw new ChecklistVersionError('VERSION_IN_USE', 'ยังมีแผนใช้งานอ้างอิงเวอร์ชันนี้อยู่');
  }
  await prisma.checklistTemplateVersion.update({
    where: { id: versionId },
    data: { status: ChecklistVersionStatus.RETIRED, retiredAt: new Date() },
  });
}
