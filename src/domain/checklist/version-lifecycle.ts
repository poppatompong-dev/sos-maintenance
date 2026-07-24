// src/domain/checklist/version-lifecycle.ts
//
// PURE publish-time validation for a checklist version draft. Publishing freezes
// the version; these checks guarantee a published monthly version is coherent and
// never silently drops a critical check or promises an uncapturable photo.
// "What readiness expects" (requiredCriticalFunctionKeys) is injected so the
// domain stays free of runtime constants.

export const SUPPORTED_REASON_POLICIES = new Set(['STANDARD']);
/** Only NONE is enforceable until photo upload exists (design §Photo policy). */
export const SUPPORTED_PHOTO_POLICIES_ON_PUBLISH = new Set(['NONE']);

export interface DraftMemberDef {
  itemCode: string;
  label: string;
  /** The actual versionId of the referenced item — checked against the target version. */
  itemVersionId: string;
}

export interface DraftGroupDef {
  key: string;
  label: string;
  order: number;
  required: boolean;
  reasonPolicy: string;
  photoPolicy: string;
  members: DraftMemberDef[];
}

export interface DraftItemDef {
  versionId: string;
  code: string;
  label: string;
  criticalFunctionKey?: string | null;
}

export interface PublishValidationInput {
  /** The version being published; every membership must reference an item of THIS version. */
  versionId: string;
  groups: DraftGroupDef[];
  items: DraftItemDef[];
  requiredCriticalFunctionKeys: string[];
}

export interface PublishValidationResult {
  ok: boolean;
  errors: string[];
}

const isBlank = (s: string): boolean => s.trim().length === 0;

export function validateChecklistVersionForPublish(
  input: PublishValidationInput,
): PublishValidationResult {
  const errors: string[] = [];
  const itemCodes = new Set(input.items.map((i) => i.code));

  // Unique group keys and orders (among all groups).
  const seenKeys = new Set<string>();
  const seenOrders = new Set<number>();
  for (const g of input.groups) {
    if (seenKeys.has(g.key)) errors.push(`คีย์กลุ่มซ้ำ: ${g.key}`);
    seenKeys.add(g.key);
    if (seenOrders.has(g.order)) errors.push(`ลำดับกลุ่มซ้ำ: ${g.order}`);
    seenOrders.add(g.order);

    if (isBlank(g.label)) errors.push(`กลุ่ม ${g.key} ต้องมีชื่อภาษาไทย`);
    if (g.required && g.members.length === 0) errors.push(`กลุ่ม ${g.key} ต้องมีสมาชิกอย่างน้อยหนึ่งรายการ`);

    for (const m of g.members) {
      // Factual same-version check: compare the member item's ACTUAL versionId,
      // not just its code (a different version may hold an item with the same code).
      if (m.itemVersionId !== input.versionId) {
        errors.push(`สมาชิก ${m.itemCode} อยู่คนละเวอร์ชันกับกลุ่ม`);
        continue;
      }
      if (!itemCodes.has(m.itemCode)) errors.push(`สมาชิก ${m.itemCode} ไม่อยู่ในเวอร์ชันนี้`);
      if (isBlank(m.label)) errors.push(`สมาชิก ${m.itemCode} ต้องมีชื่อภาษาไทย`);
    }

    if (!SUPPORTED_REASON_POLICIES.has(g.reasonPolicy)) errors.push(`นโยบายเหตุผลของกลุ่ม ${g.key} ไม่รองรับ`);
    if (!SUPPORTED_PHOTO_POLICIES_ON_PUBLISH.has(g.photoPolicy)) errors.push(`นโยบายรูปของกลุ่ม ${g.key} ไม่รองรับในรุ่นนี้`);
  }

  // Members collectively cover every required critical function.
  const coveredKeys = new Set<string>();
  const memberItemCodes = new Set(input.groups.flatMap((g) => g.members.map((m) => m.itemCode)));
  for (const item of input.items) {
    if (memberItemCodes.has(item.code) && item.criticalFunctionKey) {
      coveredKeys.add(item.criticalFunctionKey);
    }
  }
  for (const key of input.requiredCriticalFunctionKeys) {
    if (!coveredKeys.has(key)) errors.push(`เวอร์ชันนี้ยังไม่ครอบคลุมฟังก์ชันวิกฤต: ${key}`);
  }

  return { ok: errors.length === 0, errors };
}
