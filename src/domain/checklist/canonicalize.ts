// src/domain/checklist/canonicalize.ts
//
// PURE server-side trust boundary: expand a small set of group outcomes into the
// authoritative per-item EvaluatedResponse[] the readiness pipeline consumes.
// Criticality and critical-function keys are taken from the pinned version's item
// definitions, NEVER from the request. No IO, no Prisma, no framework.

import type { EvaluatedResponse, ResponseResult } from './index';

export type GroupOutcome = 'NORMAL' | 'PROBLEM' | 'UNTESTABLE';
export type MemberState = 'OK' | 'PROBLEM' | 'UNTESTED';

export interface SubmittedMember {
  memberKey: string;
  state: MemberState;
}

export interface SubmittedGroup {
  groupKey: string;
  outcome: GroupOutcome;
  members?: SubmittedMember[];
  note?: string;
  reason?: string;
}

/** Version item definition (server-authoritative). */
export interface VersionItemDef {
  code: string;
  label: string;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  criticalFunctionKey?: string | null;
}

/** Version group definition: which item codes it covers (ordered). */
export interface VersionGroupDef {
  key: string;
  required: boolean;
  memberItemCodes: string[];
}

export interface CanonicalizeInput {
  groups: VersionGroupDef[];
  items: VersionItemDef[];
  /** Code of the ungrouped item that carries the general note (empty if none). */
  generalNoteItemCode: string;
  submission: {
    groups: SubmittedGroup[];
    generalNote?: string;
  };
}

export class FieldSubmissionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FieldSubmissionError';
    this.code = code;
  }
}

const isBlank = (s: string | undefined): boolean => !s || s.trim().length === 0;

function toResponse(
  item: VersionItemDef,
  result: ResponseResult,
  note?: string,
): EvaluatedResponse {
  return {
    itemCode: item.code,
    label: item.label,
    result,
    criticality: item.criticality,
    ...(item.criticalFunctionKey ? { criticalFunctionKey: item.criticalFunctionKey } : {}),
    ...(note ? { note } : {}),
  };
}

export function canonicalizeFieldSubmission(input: CanonicalizeInput): EvaluatedResponse[] {
  const itemByCode = new Map(input.items.map((it) => [it.code, it]));
  const groupByKey = new Map(input.groups.map((g) => [g.key, g]));

  // Reject duplicate submitted group keys (no Map last-wins) and unknown groups.
  const seenGroupKeys = new Set<string>();
  for (const s of input.submission.groups) {
    if (seenGroupKeys.has(s.groupKey)) {
      throw new FieldSubmissionError('DUPLICATE_GROUP', `ส่งกลุ่มตรวจซ้ำในคำขอเดียวกัน`);
    }
    seenGroupKeys.add(s.groupKey);
    if (!groupByKey.has(s.groupKey)) {
      throw new FieldSubmissionError('UNKNOWN_GROUP', `ไม่พบกลุ่มตรวจในเวอร์ชันของใบงานนี้`);
    }
  }
  const submittedByKey = new Map(input.submission.groups.map((g) => [g.groupKey, g]));

  const responses: EvaluatedResponse[] = [];

  for (const group of input.groups) {
    const submitted = submittedByKey.get(group.key);
    if (!submitted) {
      if (group.required) {
        throw new FieldSubmissionError('REQUIRED_GROUP_MISSING', `ยังตอบกลุ่มตรวจไม่ครบ`);
      }
      continue; // optional group left unanswered
    }

    const memberItems = group.memberItemCodes.map((code) => {
      const item = itemByCode.get(code);
      if (!item) {
        throw new FieldSubmissionError('UNKNOWN_MEMBER', `รายการตรวจไม่ตรงกับเวอร์ชันของใบงาน`);
      }
      return item;
    });

    if (submitted.outcome === 'NORMAL') {
      for (const item of memberItems) responses.push(toResponse(item, 'PASS'));
      continue;
    }

    if (submitted.outcome === 'UNTESTABLE') {
      if (isBlank(submitted.reason)) {
        throw new FieldSubmissionError('UNTESTABLE_NEEDS_REASON', `กรุณาระบุเหตุผลที่ตรวจไม่ได้`);
      }
      for (const item of memberItems) responses.push(toResponse(item, 'UNKNOWN', submitted.reason));
      continue;
    }

    // PROBLEM
    const states = new Map<string, MemberState>();
    for (const m of submitted.members ?? []) {
      if (!group.memberItemCodes.includes(m.memberKey)) {
        throw new FieldSubmissionError('UNKNOWN_MEMBER', `รายการตรวจไม่ตรงกับกลุ่มที่ระบุ`);
      }
      if (states.has(m.memberKey)) {
        throw new FieldSubmissionError('DUPLICATE_MEMBER', `ส่งรายการตรวจซ้ำในกลุ่มเดียวกัน`);
      }
      states.set(m.memberKey, m.state);
    }
    const hasProblem = [...states.values()].some((s) => s === 'PROBLEM');
    if (!hasProblem) {
      throw new FieldSubmissionError('PROBLEM_NEEDS_MEMBER', `เลือกอย่างน้อยหนึ่งรายการที่มีปัญหา`);
    }
    if (isBlank(submitted.note)) {
      throw new FieldSubmissionError('PROBLEM_NEEDS_NOTE', `กรุณาระบุอาการที่พบ`);
    }
    for (const item of memberItems) {
      const state = states.get(item.code);
      if (state === 'OK') responses.push(toResponse(item, 'PASS'));
      else if (state === 'PROBLEM') responses.push(toResponse(item, 'FAIL', submitted.note));
      else responses.push(toResponse(item, 'UNKNOWN')); // UNTESTED or omitted → never PASS
    }
  }

  // General note → the ungrouped note item as an NA response carrying the text.
  if (input.generalNoteItemCode) {
    const noteItem = itemByCode.get(input.generalNoteItemCode);
    if (noteItem) {
      responses.push(toResponse(noteItem, 'NA', input.submission.generalNote));
    }
  }

  return responses;
}
