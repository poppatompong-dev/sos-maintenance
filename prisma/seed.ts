import {
  PrismaClient,
  Criticality,
  ChecklistItemKind,
  MaintenanceKind,
  RecurrenceFrequency,
  AssetLifecycleStatus,
  AppRole,
} from '@prisma/client';
import { SOS_POLES } from './seed-data/sos-poles';
import { CRITICAL_FUNCTIONS } from '../src/domain/readiness/critical-functions';

const prisma = new PrismaClient();

const ASSET_TYPE_KEY = 'SOS_POLE';
const INTERNAL_ACTOR_ID = '00000000-0000-0000-0000-000000000001';

// Component template applied to every pole. Criticality drives readiness.
const COMPONENTS: {
  key: string;
  name: string;
  criticality: Criticality;
}[] = [
  ...CRITICAL_FUNCTIONS.map((c) => ({
    key: c.key,
    name: c.label,
    criticality: Criticality.CRITICAL,
  })),
  { key: 'ups_battery', name: 'UPS/แบตเตอรี่สำรอง', criticality: Criticality.NON_CRITICAL },
  { key: 'cabinet', name: 'ตู้ควบคุมและการกันน้ำ', criticality: Criticality.NON_CRITICAL },
  { key: 'sign', name: 'ป้ายคำแนะนำการใช้งาน', criticality: Criticality.NON_CRITICAL },
  { key: 'pole_base', name: 'ฐานเสาและน็อตยึด', criticality: Criticality.NON_CRITICAL },
  { key: 'grounding', name: 'ระบบสายดิน/surge protection', criticality: Criticality.NON_CRITICAL },
];

interface ItemDef {
  code: string;
  label: string;
  kind: ChecklistItemKind;
  criticality: Criticality;
  criticalFunctionKey?: string;
  requiresPhoto?: boolean;
}

const B = ChecklistItemKind.BOOLEAN_PASS_FAIL;
const TXT = ChecklistItemKind.TEXT;
const PHOTO = ChecklistItemKind.PHOTO;
const CRIT = Criticality.CRITICAL;
const NON = Criticality.NON_CRITICAL;

/** BOOLEAN critical items, one per critical function. */
const criticalFunctionItems = (prefix: string): ItemDef[] =>
  CRITICAL_FUNCTIONS.map((c) => ({
    code: `${prefix}_${c.key}`,
    label: `ทดสอบ${c.label}`,
    kind: B,
    criticality: CRIT,
    criticalFunctionKey: c.key,
    requiresPhoto: c.key === 'camera_recording',
  }));

const CHECKLISTS: {
  key: string;
  name: string;
  kind: MaintenanceKind;
  items: ItemDef[];
}[] = [
  {
    key: 'WEEKLY_CENTER',
    name: 'ตรวจประจำสัปดาห์จากศูนย์',
    kind: MaintenanceKind.WEEKLY_CENTER,
    items: [
      { code: 'w_online', label: 'สถานะออนไลน์จากศูนย์', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
      { code: 'w_camera', label: 'ภาพกล้องปกติจากศูนย์', kind: B, criticality: CRIT, criticalFunctionKey: 'camera_recording' },
      { code: 'w_voip', label: 'คุณภาพสัญญาณเสียง/VoIP', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
      { code: 'w_note', label: 'หมายเหตุ/ความผิดปกติที่พบ', kind: TXT, criticality: NON },
    ],
  },
  {
    key: 'MONTHLY_FIELD',
    name: 'ตรวจ End-to-End รายเดือนภาคสนาม',
    kind: MaintenanceKind.MONTHLY_FIELD,
    items: [
      ...criticalFunctionItems('m'),
      { code: 'm_center_sees', label: 'ศูนย์ CCOC เห็นจุดถูกต้อง', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
      { code: 'm_exterior', label: 'สภาพภายนอก ตู้ ป้าย ฐานเสา', kind: PHOTO, criticality: NON, requiresPhoto: true },
      { code: 'm_note', label: 'หมายเหตุเพิ่มเติม', kind: TXT, criticality: NON },
    ],
  },
  {
    key: 'SEMIANNUAL_DEEP',
    name: 'ตรวจบำรุงเชิงลึกทุก 6 เดือน',
    kind: MaintenanceKind.SEMIANNUAL_DEEP,
    items: [
      ...criticalFunctionItems('s'),
      { code: 's_center_sees', label: 'ศูนย์ CCOC เห็นจุดถูกต้อง', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
      { code: 's_cabinet_seal', label: 'ซีล/การกันน้ำภายในตู้', kind: B, criticality: NON },
      { code: 's_connectors', label: 'ขั้วต่อและสายภายในตู้', kind: B, criticality: NON },
      { code: 's_power_ups', label: 'สภาพไฟ/UPS/แบตเตอรี่', kind: B, criticality: NON },
      { code: 's_water_rust', label: 'การกันน้ำ/สนิม', kind: B, criticality: NON },
      { code: 's_surge_ground', label: 'surge protection/grounding', kind: B, criticality: NON },
      { code: 's_base_bolts', label: 'ฐานเสา/น็อตยึด', kind: B, criticality: NON },
      { code: 's_config_backup', label: 'สำรอง firmware/config (หากอุปกรณ์รองรับ)', kind: B, criticality: NON },
      { code: 's_exterior', label: 'ภาพสภาพภายนอกและภายในตู้', kind: PHOTO, criticality: NON, requiresPhoto: true },
      { code: 's_note', label: 'หมายเหตุเพิ่มเติม', kind: TXT, criticality: NON },
    ],
  },
  {
    key: 'INITIAL_SURVEY',
    name: 'สำรวจตั้งต้น',
    kind: MaintenanceKind.INITIAL_SURVEY,
    items: [
      { code: 'is_confirm', label: 'ยืนยันรหัส/ชื่อจุด/พิกัดจริง', kind: B, criticality: NON, requiresPhoto: true },
      { code: 'is_photo_wide', label: 'ภาพกว้างจุดติดตั้ง', kind: PHOTO, criticality: NON, requiresPhoto: true },
      { code: 'is_photo_sign', label: 'ภาพป้ายคำแนะนำ', kind: PHOTO, criticality: NON, requiresPhoto: true },
      { code: 'is_photo_equipment', label: 'ภาพอุปกรณ์ภายในตู้', kind: PHOTO, criticality: NON, requiresPhoto: true },
      ...criticalFunctionItems('is'),
      { code: 'is_e2e_ccoc', label: 'ทดสอบ End-to-End ถึงผู้รับที่ศูนย์ CCOC', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
      { code: 'is_unknown', label: 'ไม่ทราบ/ไม่สามารถเปิดตรวจ (หมายเหตุ)', kind: TXT, criticality: NON },
    ],
  },
  {
    key: 'CORRECTIVE',
    name: 'ซ่อมและตรวจซ้ำ (Retest)',
    kind: MaintenanceKind.CORRECTIVE,
    items: [
      ...criticalFunctionItems('c'),
      { code: 'c_note', label: 'หมายเหตุการซ่อม/ตรวจซ้ำ', kind: TXT, criticality: NON },
    ],
  },
];

// Recurring plans → their checklist. INITIAL_SURVEY & CORRECTIVE are event-driven.
const PLANS: {
  name: string;
  kind: MaintenanceKind;
  frequency: RecurrenceFrequency;
  checklistKey: string;
}[] = [
  { name: 'แผนตรวจประจำสัปดาห์', kind: MaintenanceKind.WEEKLY_CENTER, frequency: RecurrenceFrequency.WEEKLY, checklistKey: 'WEEKLY_CENTER' },
  { name: 'แผนตรวจรายเดือน', kind: MaintenanceKind.MONTHLY_FIELD, frequency: RecurrenceFrequency.MONTHLY, checklistKey: 'MONTHLY_FIELD' },
  { name: 'แผนตรวจเชิงลึกทุก 6 เดือน', kind: MaintenanceKind.SEMIANNUAL_DEEP, frequency: RecurrenceFrequency.SEMIANNUAL, checklistKey: 'SEMIANNUAL_DEEP' },
];

async function main() {
  console.log('▶ Seeding SOS maintenance reference data…');

  // Explicit AUTH_MODE=internal deployments need one stable DB actor for
  // append-only work logs and schedule metadata. This is not a login account.
  await prisma.user.upsert({
    where: { id: INTERNAL_ACTOR_ID },
    update: {
      username: 'internal-operator',
      displayName: 'เจ้าหน้าที่ภายใน (ไม่ใช้ login)',
      roles: [AppRole.SYSTEM_ADMIN, AppRole.PLANNER, AppRole.TECHNICIAN, AppRole.EXECUTIVE],
      active: true,
      retiredAt: null,
    },
    create: {
      id: INTERNAL_ACTOR_ID,
      username: 'internal-operator',
      displayName: 'เจ้าหน้าที่ภายใน (ไม่ใช้ login)',
      roles: [AppRole.SYSTEM_ADMIN, AppRole.PLANNER, AppRole.TECHNICIAN, AppRole.EXECUTIVE],
    },
  });

  const assetType = await prisma.assetType.upsert({
    where: { key: ASSET_TYPE_KEY },
    update: { name: 'เสาขอความช่วยเหลือฉุกเฉิน SOS' },
    create: {
      key: ASSET_TYPE_KEY,
      name: 'เสาขอความช่วยเหลือฉุกเฉิน SOS',
      metadataSchema: {
        type: 'object',
        properties: { smartSafetyZone: { type: 'boolean' } },
      },
    },
  });

  // Integration sources (manual entry + legacy dashboard import).
  await prisma.integrationSource.upsert({
    where: { key: 'MANUAL' },
    update: {},
    create: { key: 'MANUAL', name: 'บันทึกด้วยเจ้าหน้าที่', kind: 'MANUAL' },
  });
  await prisma.integrationSource.upsert({
    where: { key: 'LEGACY_DASHBOARD' },
    update: {},
    create: { key: 'LEGACY_DASHBOARD', name: 'นำเข้าจาก Dashboard เดิม (CSV)', kind: 'CSV' },
  });

  // Checklist templates + version 1 + items.
  const versionIdByKey = new Map<string, string>();
  for (const cl of CHECKLISTS) {
    const template = await prisma.checklistTemplate.upsert({
      where: { key: cl.key },
      update: { name: cl.name, kind: cl.kind },
      create: { key: cl.key, name: cl.name, kind: cl.kind },
    });

    const version = await prisma.checklistTemplateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: 1 } },
      update: {},
      create: {
        templateId: template.id,
        version: 1,
        publishedAt: new Date(),
        isLocked: false,
      },
    });
    versionIdByKey.set(cl.key, version.id);

    // Seed versions are never locked; refresh items so re-seed stays in sync.
    if (!version.isLocked) {
      await prisma.checklistItem.deleteMany({ where: { versionId: version.id } });
      await prisma.checklistItem.createMany({
        data: cl.items.map((it, i) => ({
          versionId: version.id,
          order: i + 1,
          code: it.code,
          label: it.label,
          kind: it.kind,
          criticality: it.criticality,
          criticalFunctionKey: it.criticalFunctionKey ?? null,
          requiresPhoto: it.requiresPhoto ?? false,
        })),
      });
    }
  }

  // Maintenance plans.
  for (const p of PLANS) {
    const versionId = versionIdByKey.get(p.checklistKey)!;
    await prisma.maintenancePlan.upsert({
      where: { kind_assetTypeKey: { kind: p.kind, assetTypeKey: ASSET_TYPE_KEY } },
      update: { name: p.name, frequency: p.frequency, checklistVersionId: versionId },
      create: {
        name: p.name,
        kind: p.kind,
        frequency: p.frequency,
        assetTypeKey: ASSET_TYPE_KEY,
        checklistVersionId: versionId,
      },
    });
  }

  // 27 poles: Location + Asset + Components. baselineApproved=false → UNKNOWN
  // until an Initial Survey is approved (doc 01 readiness rules).
  for (const pole of SOS_POLES) {
    const location = await prisma.location.upsert({
      where: { code: pole.code },
      update: { name: pole.name, longitude: pole.longitude, latitude: pole.latitude },
      create: {
        code: pole.code,
        name: pole.name,
        longitude: pole.longitude,
        latitude: pole.latitude,
      },
    });

    const asset = await prisma.asset.upsert({
      where: { code: pole.code },
      update: {
        name: pole.name,
        longitude: pole.longitude,
        latitude: pole.latitude,
        locationId: location.id,
      },
      create: {
        code: pole.code,
        name: pole.name,
        assetTypeId: assetType.id,
        locationId: location.id,
        longitude: pole.longitude,
        latitude: pole.latitude,
        qrToken: `qr_${pole.code}`,
        lifecycle: AssetLifecycleStatus.ACTIVE,
        baselineApproved: false,
        currentReadiness: 'UNKNOWN',
      },
    });

    for (const c of COMPONENTS) {
      await prisma.assetComponent.upsert({
        where: { assetId_key: { assetId: asset.id, key: c.key } },
        update: { name: c.name, criticality: c.criticality },
        create: {
          assetId: asset.id,
          key: c.key,
          name: c.name,
          criticality: c.criticality,
        },
      });
    }
  }

  const [assets, components, items, plans] = await Promise.all([
    prisma.asset.count(),
    prisma.assetComponent.count(),
    prisma.checklistItem.count(),
    prisma.maintenancePlan.count(),
  ]);
  console.log(
    `✔ Seed complete: ${assets} assets, ${components} components, ${items} checklist items, ${plans} plans.`,
  );
}

main()
  .catch((e) => {
    console.error('✖ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
