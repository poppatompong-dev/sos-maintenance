// prisma/checklist-v2.ts
//
// Rollout LIBRARY for MONTHLY_FIELD checklist VERSION 2 — the grouped field
// experience. Exports the canonical definition, a pure content fingerprint, and an
// idempotent `rolloutMonthlyV2`. NO top-level side effects, so tests may import it.
//
// Safety:
//   - creation is ATOMIC (single $transaction) so a crash cannot leave a partially
//     authored draft;
//   - RETIRED -> refuse (never resurrect);
//   - ANY other existing v2 (DRAFT *or* PUBLISHED) must match the EXACT content
//     fingerprint before it is trusted or repointed. A drifted or tampered published
//     version is therefore never repointed to — the operator must reset and re-run.
// The fingerprint covers every authored field: each item's order, code, label, kind,
// criticality, criticalFunctionKey and requiresPhoto; each group's key, label,
// helpText, order, required, reason/photo policy and ordered membership.

import {
  ChecklistItemKind,
  ChecklistPhotoPolicy,
  ChecklistReasonPolicy,
  ChecklistVersionStatus,
  Criticality,
  MaintenanceKind,
  type PrismaClient,
} from '@prisma/client';
import { CRITICAL_FUNCTIONS } from '../src/domain/readiness/critical-functions';
import { publishChecklistVersion, repointPlanToVersion } from '../src/server/services/checklist-version';

const ASSET_TYPE_KEY = 'SOS_POLE';
const B = ChecklistItemKind.BOOLEAN_PASS_FAIL;
const TXT = ChecklistItemKind.TEXT;
const CRIT = Criticality.CRITICAL;
const NON = Criticality.NON_CRITICAL;

export interface V2Item {
  code: string;
  label: string;
  kind: ChecklistItemKind;
  criticality: Criticality;
  criticalFunctionKey: string | null;
}

// Ten monthly items (requiresPhoto is false for ALL — no photo capture this slice).
export const V2_ITEMS: V2Item[] = [
  { code: 'm_operating_power', label: 'ไฟเลี้ยงระบบ', kind: B, criticality: CRIT, criticalFunctionKey: 'operating_power' },
  { code: 'm_sos_button', label: 'ปุ่ม SOS', kind: B, criticality: CRIT, criticalFunctionKey: 'sos_button' },
  { code: 'm_confirmation_signal', label: 'ไฟ/เสียงยืนยัน', kind: B, criticality: CRIT, criticalFunctionKey: 'confirmation_signal' },
  { code: 'm_microphone', label: 'ไมโครโฟน', kind: B, criticality: CRIT, criticalFunctionKey: 'microphone' },
  { code: 'm_speaker_two_way_audio', label: 'ลำโพง/เสียงสองทาง', kind: B, criticality: CRIT, criticalFunctionKey: 'speaker_two_way_audio' },
  { code: 'm_network_voip', label: 'เครือข่าย/VoIP', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
  { code: 'm_center_sees', label: 'ศูนย์เห็นตำแหน่งถูกต้อง', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
  { code: 'm_camera_recording', label: 'กล้องและการบันทึกภาพ', kind: B, criticality: CRIT, criticalFunctionKey: 'camera_recording' },
  { code: 'm_exterior', label: 'สภาพตู้/ป้าย/ฐานเสาภายนอก', kind: B, criticality: NON, criticalFunctionKey: null },
  { code: 'm_note', label: 'หมายเหตุเพิ่มเติม', kind: TXT, criticality: NON, criticalFunctionKey: null },
];

export interface V2Group {
  key: string;
  label: string;
  helpText: string;
  order: number;
  memberItemCodes: string[];
}

export const V2_GROUPS: V2Group[] = [
  { key: 'power_readiness', label: 'ระบบมีไฟเลี้ยงและพร้อมทำงาน', helpText: 'ตรวจว่าเสามีไฟเลี้ยงและระบบเปิดทำงานปกติ', order: 1, memberItemCodes: ['m_operating_power'] },
  { key: 'sos_button_signal', label: 'กดปุ่ม SOS แล้วมีไฟและเสียงยืนยัน', helpText: 'กดปุ่มขอความช่วยเหลือแล้วมีไฟและเสียงตอบรับ', order: 2, memberItemCodes: ['m_sos_button', 'm_confirmation_signal'] },
  { key: 'two_way_audio', label: 'สนทนาสองทางกับเจ้าหน้าที่ได้ชัดเจน', helpText: 'พูดและฟังกับเจ้าหน้าที่ศูนย์ได้ชัดทั้งสองทาง', order: 3, memberItemCodes: ['m_microphone', 'm_speaker_two_way_audio', 'm_network_voip'] },
  { key: 'center_view_camera', label: 'ศูนย์เห็นจุดถูกต้องและกล้อง/การบันทึกทำงาน', helpText: 'ยืนยันกับศูนย์ว่าเห็นตำแหน่งถูกต้อง และภาพกล้อง/การบันทึกใช้งานได้', order: 4, memberItemCodes: ['m_center_sees', 'm_camera_recording'] },
  { key: 'exterior_condition', label: 'สภาพตู้ ป้าย และฐานเสาภายนอกเรียบร้อย', helpText: 'ตรวจความเรียบร้อยของตู้ ป้ายคำแนะนำ และฐานเสาจากภายนอก', order: 5, memberItemCodes: ['m_exterior'] },
];

/**
 * Deterministic content fingerprint over EVERY authored field. Item order is the
 * array position (mirrors the `order: i + 1` used when creating the version), and
 * item label is included so a relabelled or reordered version fails verification.
 */
export function fingerprintDefinition(items: V2Item[], groups: V2Group[]): string {
  const itemPart = items
    .map((it, i) => `${i + 1}|${it.code}|${it.label}|${it.kind}|${it.criticality}|${it.criticalFunctionKey ?? ''}|photo=false`)
    .join(';');
  const groupPart = groups
    .map((g) => `${g.key}|${g.label}|${g.helpText}|${g.order}|required=true|STANDARD|NONE|${g.memberItemCodes.join(',')}`)
    .join(';');
  return `items:${itemPart}::groups:${groupPart}`;
}

export function expectedFingerprint(): string {
  return fingerprintDefinition(V2_ITEMS, V2_GROUPS);
}

export interface RolloutResult {
  versionId: string;
  created: boolean;
}

class RolloutError extends Error {}

/** Create v2 (version + items + groups + memberships) inside ONE transaction. */
async function createDraftV2Atomic(prisma: PrismaClient, templateId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const version = await tx.checklistTemplateVersion.create({
      data: {
        templateId,
        version: 2,
        status: ChecklistVersionStatus.DRAFT,
        items: {
          create: V2_ITEMS.map((it, i) => ({
            order: i + 1,
            code: it.code,
            label: it.label,
            kind: it.kind,
            criticality: it.criticality,
            criticalFunctionKey: it.criticalFunctionKey,
            requiresPhoto: false,
          })),
        },
        fieldGroups: {
          create: V2_GROUPS.map((g) => ({
            key: g.key,
            label: g.label,
            helpText: g.helpText,
            order: g.order,
            required: true,
            reasonPolicy: ChecklistReasonPolicy.STANDARD,
            photoPolicy: ChecklistPhotoPolicy.NONE,
          })),
        },
      },
      select: { id: true },
    });

    const groups = await tx.checklistFieldGroup.findMany({
      where: { checklistVersionId: version.id },
      select: { id: true, key: true },
    });
    const groupIdByKey = new Map(groups.map((g) => [g.key, g.id]));
    for (const g of V2_GROUPS) {
      const groupId = groupIdByKey.get(g.key)!;
      for (let i = 0; i < g.memberItemCodes.length; i++) {
        await tx.checklistItem.update({
          where: { versionId_code: { versionId: version.id, code: g.memberItemCodes[i] } },
          data: { fieldGroupId: groupId, memberOrder: i + 1 },
        });
      }
    }
    return version.id;
  });
}

/** Rebuild the fingerprint from what is ACTUALLY stored for a version. */
async function actualFingerprint(prisma: PrismaClient, versionId: string): Promise<string> {
  const version = await prisma.checklistTemplateVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: {
      items: {
        orderBy: { order: 'asc' },
        select: { order: true, code: true, label: true, kind: true, criticality: true, criticalFunctionKey: true, requiresPhoto: true, fieldGroupId: true, memberOrder: true },
      },
      fieldGroups: {
        orderBy: { order: 'asc' },
        select: { id: true, key: true, label: true, helpText: true, order: true, required: true, reasonPolicy: true, photoPolicy: true },
      },
    },
  });

  const itemPart = version.items
    .map((it) => `${it.order}|${it.code}|${it.label}|${it.kind}|${it.criticality}|${it.criticalFunctionKey ?? ''}|photo=${it.requiresPhoto}`)
    .join(';');
  const groupPart = version.fieldGroups
    .map((g) => {
      const members = version.items
        .filter((it) => it.fieldGroupId === g.id)
        .sort((a, b) => (a.memberOrder ?? 0) - (b.memberOrder ?? 0))
        .map((it) => it.code);
      return `${g.key}|${g.label}|${g.helpText ?? ''}|${g.order}|required=${g.required}|${g.reasonPolicy}|${g.photoPolicy}|${members.join(',')}`;
    })
    .join(';');
  return `items:${itemPart}::groups:${groupPart}`;
}

/**
 * Idempotently ensure the grouped monthly v2 exists, is published, and the monthly
 * plan points at it. Never mutates a frozen version; refuses a RETIRED v2 and any
 * existing v2 (DRAFT or PUBLISHED) whose stored content does not match the exact
 * fingerprint. Requires the reference seed (template + plan) to exist.
 */
export async function rolloutMonthlyV2(prisma: PrismaClient): Promise<RolloutResult> {
  const template = await prisma.checklistTemplate.findUnique({ where: { key: 'MONTHLY_FIELD' } });
  if (!template) throw new RolloutError('Missing MONTHLY_FIELD template. Run `pnpm db:seed` first.');

  const plan = await prisma.maintenancePlan.findUnique({
    where: { kind_assetTypeKey: { kind: MaintenanceKind.MONTHLY_FIELD, assetTypeKey: ASSET_TYPE_KEY } },
  });
  if (!plan) throw new RolloutError('Missing monthly maintenance plan. Run `pnpm db:seed` first.');

  const existing = await prisma.checklistTemplateVersion.findUnique({
    where: { templateId_version: { templateId: template.id, version: 2 } },
    select: { id: true, status: true },
  });

  let versionId: string;
  let created = false;
  if (!existing) {
    versionId = await createDraftV2Atomic(prisma, template.id);
    created = true;
  } else if (existing.status === ChecklistVersionStatus.RETIRED) {
    throw new RolloutError('Monthly checklist v2 is RETIRED; refusing to resurrect it. Reset the local DB and re-run.');
  } else {
    versionId = existing.id;
    // Verify ANY existing v2 — DRAFT or PUBLISHED — against the exact content
    // fingerprint BEFORE trusting/publishing/repointing it. A drifted or tampered
    // published version is never repointed to; the operator must reset and re-run.
    const actual = await actualFingerprint(prisma, versionId);
    if (actual !== expectedFingerprint()) {
      throw new RolloutError(
        `Existing monthly v2 (status ${existing.status}) does not match the expected definition; refusing to trust or repoint it. Reset the local DB and re-run.`,
      );
    }
  }

  // publishChecklistVersion is a no-op if already PUBLISHED; validates+freezes a DRAFT.
  await publishChecklistVersion(prisma, versionId, CRITICAL_FUNCTIONS.map((c) => c.key));
  await repointPlanToVersion(prisma, plan.id, versionId);
  return { versionId, created };
}
