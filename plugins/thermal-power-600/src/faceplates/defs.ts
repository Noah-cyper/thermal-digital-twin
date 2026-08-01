// Plugin thermal-power-600 — FaceplateDef khai báo (doc 05-15). Dữ liệu thuần, chỉ import type từ
// @idtp/sdk. 4 tab cố định; gắn control loop + tag PV/OP + alarm + trend. KKS neo Phụ lục A §10.1.
// 3 faceplate CHI TIẾT (KKS + alarm + trend đa tag) cho các vòng trọng yếu; phần còn lại TỰ SINH từ
// registry vòng điều khiển để MỌI vòng đều mở được faceplate (PV/SP/OP/mode/trend) — HMI polish v1.41.
import type { FaceplateDef } from '@idtp/sdk';
import { boilerControlLoops } from '../control/loops';

/** Faceplate chi tiết cho vòng trọng yếu (đầy đủ KKS + alarm + trend nhiều tag). */
const detailedFaceplates: ReadonlyArray<FaceplateDef> = [
  {
    faceplateId: 'fp-drum-level',
    assetId: 'PID-DRUM-LEVEL',
    title: { vi: 'Mức bao hơi (3-element)', en: 'Drum level (3-element)' },
    loopId: 'drum-level',
    pvTag: 'BLR_DRUM_LEVEL_01',
    sp: 0,
    opTag: 'BLR_FW_CV_01',
    eu: 'mm',
    rangeLo: -400,
    rangeHi: 400,
    kks: '10HAD10CL001',
    alarmIds: ['BLR-DRUM-LVL-HH', 'BLR-DRUM-LVL-HI', 'BLR-DRUM-LVL-LO', 'BLR-DRUM-LVL-LL'],
    trendTags: ['BLR_DRUM_LEVEL_01', 'BLR_STEAM_FLOW_01', 'BLR_FW_FLOW_01'],
  },
  {
    faceplateId: 'fp-main-steam-pressure',
    assetId: 'PID-MSTM-PRESS',
    title: { vi: 'Áp hơi chính (boiler master)', en: 'Main steam pressure (boiler master)' },
    loopId: 'boiler-master-pressure',
    pvTag: 'BLR_MSTM_SH_PRESS_01',
    sp: 17.5,
    opTag: 'BLR_FIRING_DEMAND',
    eu: 'MPa',
    rangeLo: 0,
    rangeHi: 22,
    kks: '10LAB10CP001',
    alarmIds: ['BLR-MSTM-PRESS-HH', 'BLR-MSTM-PRESS-LO'],
    trendTags: ['BLR_MSTM_SH_PRESS_01', 'BLR_COAL_FLOW_01'],
  },
  {
    faceplateId: 'fp-sh-temp',
    assetId: 'PID-SH-TEMP',
    title: { vi: 'Nhiệt độ hơi SH (spray)', en: 'SH steam temp (spray)' },
    loopId: 'sh-temp',
    pvTag: 'BLR_MSTM_SH_TEMP_01',
    sp: 541,
    opTag: 'BLR_SH_SPRAY_CV_01',
    eu: 'degC',
    rangeLo: 0,
    rangeHi: 600,
    kks: '10LBA10CT001',
    alarmIds: ['BLR-MSTM-TEMP-HH'],
    trendTags: ['BLR_MSTM_SH_TEMP_01'],
  },
];

/** Suy đơn vị kỹ thuật (EU) từ tên tag PV — cosmetic, phục vụ tab Detail của faceplate tự sinh. */
function euFor(tag: string): string {
  if (/TEMP|DEWPOINT/.test(tag)) return '°C';
  if (/NOX|SO2/.test(tag)) return 'mg/Nm³';
  if (/GLAND_PRESS/.test(tag)) return 'kPag';
  if (/PA_HEADER_PRESS/.test(tag)) return 'kPa';
  if (/FURN_PRESS/.test(tag)) return 'Pa';
  if (/^CA_|^FO_/.test(tag) && /PRESS/.test(tag)) return 'barg';
  if (/PRESS|_DP_/.test(tag)) return 'MPa';
  if (/LEVEL|_O2_/.test(tag)) return '%';
  if (/FLOW/.test(tag)) return 't/h';
  if (/GEN_MW|_MW_/.test(tag)) return 'MW';
  return '';
}

/** Tự sinh faceplate cho vòng chưa có faceplate chi tiết → MỌI tag PV của vòng đều mở được faceplate.
 *  Khử trùng theo pvTag: nếu 2 vòng dùng chung 1 PV (vd hp-bypass giám sát áp SH cùng boiler-master), tag
 *  đó chỉ có 1 faceplate (của vòng điều khiển chính) — giữ click-map pvTag→assetId sạch. */
const detailedLoopIds = new Set(detailedFaceplates.map((f) => f.loopId));
const seenPvTags = new Set<string>(detailedFaceplates.map((f) => f.pvTag));
const autoFaceplates: FaceplateDef[] = [];
for (const l of boilerControlLoops) {
  if (detailedLoopIds.has(l.id) || seenPvTags.has(l.pvTag)) continue;
  seenPvTags.add(l.pvTag);
  autoFaceplates.push({
    faceplateId: `fp-${l.id}`,
    assetId: `PID-${l.id.toUpperCase()}`,
    title: { vi: ((l.desc ?? l.id).split(':')[0] ?? l.id).trim(), en: l.id },
    loopId: l.id,
    pvTag: l.pvTag,
    ...(l.spTag !== undefined ? { spTag: l.spTag } : l.sp !== undefined ? { sp: l.sp } : {}),
    opTag: l.outTag,
    eu: euFor(l.pvTag),
    trendTags: [l.pvTag, l.outTag],
  });
}

/** 25 faceplate: 3 chi tiết + 22 tự sinh (một cho mỗi vòng điều khiển CCS). */
export const thermalFaceplates: ReadonlyArray<FaceplateDef> = [...detailedFaceplates, ...autoFaceplates];
