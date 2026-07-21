/**
 * Initial critical-function set for an SOS pole (doc 01/08). A pole is DOWN the
 * moment any of these latest results fails. This list is the V1 default only —
 * criticality is stored per AssetComponent in the DB and may change over time
 * (doc 07 field assumption: "critical component list may change"), so services
 * should read the asset's flagged-critical components rather than hard-coding
 * this at runtime.
 */
export const CRITICAL_FUNCTIONS = [
  { key: 'sos_button', label: 'ปุ่ม SOS' },
  { key: 'confirmation_signal', label: 'ไฟ/เสียงยืนยัน' },
  { key: 'microphone', label: 'ไมโครโฟน' },
  { key: 'speaker_two_way_audio', label: 'ลำโพง/เสียงสองทาง' },
  { key: 'camera_recording', label: 'กล้องและการบันทึกภาพที่กำหนด' },
  { key: 'network_voip', label: 'เครือข่าย/VoIP' },
  { key: 'operating_power', label: 'ไฟเลี้ยงระบบ' },
] as const;

export type CriticalFunctionKey = (typeof CRITICAL_FUNCTIONS)[number]['key'];
