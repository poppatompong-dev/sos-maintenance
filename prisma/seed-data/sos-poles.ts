/**
 * Canonical initial registry of the 27 SOS poles (doc 08).
 * Coordinates are WGS84 [longitude, latitude] and are SEED ONLY — field crews
 * must confirm real coordinates via the Initial Survey; public coordinates are
 * never treated as final field evidence (doc 07).
 */
export interface SosPoleSeed {
  code: string;
  name: string;
  longitude: number;
  latitude: number;
}

export const SOS_POLES: SosPoleSeed[] = [
  { code: 'EP01', name: 'ข้างป้ายอุทยานสวรรค์ (ฝั่งโกยี)', longitude: 100.1220556, latitude: 15.6975278 },
  { code: 'EP02', name: 'ทางขึ้นสะพานเกาะกลาง', longitude: 100.1258611, latitude: 15.7000278 },
  { code: 'EP03', name: 'ทางขึ้นสะพานแขวน', longitude: 100.128555555556, latitude: 15.7022777777778 },
  { code: 'EP04', name: 'ลานกีฬาอุทยานสวรรค์', longitude: 100.129166666667, latitude: 15.7049166666667 },
  { code: 'EP05', name: 'สะพานเล็กเกาะกลาง', longitude: 100.1251231, latitude: 15.7026748 },
  { code: 'EP06', name: 'หน้าประตู 8 (ตรงข้ามตรอกลิเก)', longitude: 100.130916666667, latitude: 15.701 },
  { code: 'EP07', name: 'หน้าสถานีขนส่ง (ศูนย์ท่ารถ)', longitude: 100.1183712, latitude: 15.7017082 },
  { code: 'EP08', name: 'ต้นซอยวัชระ', longitude: 100.1187648, latitude: 15.6994607 },
  { code: 'EP09', name: 'หน้ามหาวิทยาลัยภาคกลาง', longitude: 100.1131188, latitude: 15.6968514 },
  { code: 'EP10', name: 'ทางเข้าตลาดสวนขอบฟ้า', longitude: 100.1032672, latitude: 15.6957272 },
  { code: 'EP11', name: 'ทางเข้าตลาดศรีนคร', longitude: 100.106362, latitude: 15.683038 },
  { code: 'EP12', name: 'หน้าตลาดเพชรพิชญา', longitude: 100.1444562, latitude: 15.7110947 },
  { code: 'EP13', name: 'แยกป่าช้าจีน', longitude: 100.131888888889, latitude: 15.7207222222222 },
  { code: 'EP14', name: 'แยกนวมินทร์', longitude: 100.117527777778, latitude: 15.7207222222222 },
  { code: 'EP15', name: 'สามแยกปลดแอกข้างอุทยานสวรรค์', longitude: 100.1299877, latitude: 15.7056751 },
  { code: 'EP16', name: 'แยกก๋วยเตี๋ยวเจ๊สั้น', longitude: 100.126916666667, latitude: 15.6978611111111 },
  { code: 'EP17', name: 'ตลาดบ่อนไก่ริมน้ำข้างสำนักงานทรัพย์สินฯ', longitude: 100.1436484, latitude: 15.7053884 },
  { code: 'EP18', name: 'สถานีวิทยุแห่งประเทศไทยจังหวัดนครสวรรค์', longitude: 100.1219125, latitude: 15.6892978 },
  { code: 'EP19', name: 'หน้าวิทยาลัยเทคนิคนครสวรรค์', longitude: 100.1163532, latitude: 15.6923438 },
  { code: 'EP20', name: 'หน้าแฟลตพนักงานเทศบาล', longitude: 100.137138888889, latitude: 15.7151388888889 },
  { code: 'EP21', name: 'หน้าโรงเรียนลาซาลโชติรวี', longitude: 100.139944444444, latitude: 15.7193055555556 },
  { code: 'EP22', name: 'สามแยกชุมชนป่าไม้ ท้ายคลองญวน', longitude: 100.1267518, latitude: 15.6930036 },
  { code: 'EP23', name: 'แยกท่าทอง', longitude: 100.102611111111, latitude: 15.6795 },
  { code: 'EP24', name: 'หน้าเซเว่นฝั่งตรงข้าม สสจ.นครสวรรค์', longitude: 100.1042521, latitude: 15.7067421 },
  { code: 'EP25', name: 'สามแยกหน้าป้ายต้นแม่น้ำเจ้าพระยา', longitude: 100.1399548, latitude: 15.7017224 },
  { code: 'EP26', name: 'หน้าตลาดรวยทรัพย์', longitude: 100.107944444444, latitude: 15.7161944444444 },
  { code: 'EP27', name: 'หน้าหมู่บ้านการุณรังษีตลาดใต้', longitude: 100.102277777778, latitude: 15.6731666666667 },
];
