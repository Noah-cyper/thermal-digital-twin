// Plugin thermal-power-600 — rationalization alarm (ISA-18.2 giai đoạn Identification & Rationalization, doc 08).
// Dữ liệu THUẦN KHAI BÁO: CHỈ import type từ @idtp/sdk. LỚP BỔ SUNG cạnh AlarmDef (đã có consequence +
// corrective) — thêm NGUYÊN NHÂN gốc, THỜI GIAN PHẢN ỨNG (giây), CĂN CỨ ưu tiên, trạng thái ĐÃ DUYỆT. TÁCH
// khỏi AlarmDef để KHÔNG đụng type/engine (0 hồi quy). buildAlarmRationalization() gộp AlarmDef × rationalization
// → báo cáo: độ phủ, phân bố ưu tiên vs mục tiêu EEMUA-191, danh sách chưa rationalize.
import type { AlarmDef, Priority } from '@idtp/sdk';

/** Bản ghi rationalization một alarm (ISA-18.2). Nối với AlarmDef qua alarmId. */
export interface AlarmRationalization {
  readonly alarmId: string;
  readonly cause: { vi: string; en: string }; // nguyên nhân gốc gây alarm
  readonly responseTimeSec: number; // thời gian người vận hành phải phản ứng (cơ sở xếp ưu tiên)
  readonly priorityBasis: { vi: string; en: string }; // căn cứ ưu tiên (hậu quả × thời gian khả dụng)
  readonly reviewed: boolean; // đã review/duyệt (giai đoạn D&R)
}

// Mục tiêu phân bố ưu tiên EEMUA-191 (% alarm trình bày): P1 ~5%, P2 ~15%, P3 ~80%.
export const EEMUA_PRIORITY_TARGET: Readonly<Record<'P1' | 'P2' | 'P3', number>> = { P1: 5, P2: 15, P3: 80 };
// Dung sai P1: subset an toàn tự nhiên nặng P1; cờ đạt khi P1 share ≤ ngưỡng.
const P1_SHARE_MAX_PCT = 10;

export const thermalAlarmRationalization: ReadonlyArray<AlarmRationalization> = [
  { alarmId: 'BLR-DRUM-LVL-HH', cause: { vi: 'Cấp nước vượt hơi / hỏng 3-element', en: 'Feedwater exceeds steam / 3-element fault' }, responseTimeSec: 30, priorityBasis: { vi: 'Cuốn nước sang turbine → hư cánh; thời gian ngắn', en: 'Carryover damages turbine; short time' }, reviewed: true },
  { alarmId: 'BLR-DRUM-LVL-LL', cause: { vi: 'Mất bơm nước cấp / rò ống', en: 'BFP loss / tube leak' }, responseTimeSec: 30, priorityBasis: { vi: 'Cạn lò → cháy ống; MFT bảo vệ', en: 'Dryout burns tubes; protective MFT' }, reviewed: true },
  { alarmId: 'BLR-DRUM-LVL-HI', cause: { vi: 'Cấp nước hơi cao', en: 'Feedwater slightly high' }, responseTimeSec: 120, priorityBasis: { vi: 'Cảnh báo sớm trước HH', en: 'Pre-alarm before HH' }, reviewed: true },
  { alarmId: 'BLR-DRUM-LVL-LO', cause: { vi: 'Cấp nước hơi thấp', en: 'Feedwater slightly low' }, responseTimeSec: 120, priorityBasis: { vi: 'Cảnh báo sớm trước LL', en: 'Pre-alarm before LL' }, reviewed: true },
  { alarmId: 'BLR-MSTM-PRESS-HH', cause: { vi: 'Đốt vượt nhu cầu turbine / van kẹt', en: 'Firing exceeds turbine / valve stuck' }, responseTimeSec: 30, priorityBasis: { vi: 'Quá áp → van an toàn nhả', en: 'Overpressure lifts safety valve' }, reviewed: true },
  { alarmId: 'BLR-MSTM-PRESS-LO', cause: { vi: 'Đốt thiếu / tải tăng nhanh', en: 'Under-firing / fast load rise' }, responseTimeSec: 120, priorityBasis: { vi: 'Áp thấp → hạn công suất', en: 'Low pressure limits output' }, reviewed: true },
  { alarmId: 'BLR-MSTM-TEMP-HH', cause: { vi: 'Van giảm ôn kẹt / gió lệch', en: 'Desuperheater stuck / air skew' }, responseTimeSec: 60, priorityBasis: { vi: 'Quá nhiệt → mỏi ống SH/turbine', en: 'Overtemp fatigues SH/turbine' }, reviewed: true },
  { alarmId: 'BLR-FLUE-O2-LO', cause: { vi: 'Thiếu gió cháy / quá tải nghiền', en: 'Insufficient air / mill overload' }, responseTimeSec: 60, priorityBasis: { vi: 'Cháy không hết → CO, nguy cơ nổ', en: 'Incomplete combustion; explosion risk' }, reviewed: true },
  { alarmId: 'BLR-FURN-PRESS-HH', cause: { vi: 'Mất quạt khói ID / puff cháy', en: 'ID fan loss / combustion puff' }, responseTimeSec: 30, priorityBasis: { vi: 'Quá áp buồng lửa → hư kết cấu', en: 'Furnace overpressure damages structure' }, reviewed: true },
  { alarmId: 'BLR-FURN-PRESS-LL', cause: { vi: 'Mất quạt gió FD / implosion', en: 'FD fan loss / implosion' }, responseTimeSec: 30, priorityBasis: { vi: 'Chân không buồng lửa → móp vách', en: 'Furnace vacuum implodes walls' }, reviewed: true },
  { alarmId: 'SB-FOULING-HI', cause: { vi: 'Bám bẩn bề mặt truyền nhiệt', en: 'Heat-surface fouling' }, responseTimeSec: 1800, priorityBasis: { vi: 'Giảm hiệu suất, xử lý theo ca', en: 'Efficiency loss, shift-basis action' }, reviewed: true },
  { alarmId: 'SB-STEAM-PRESS-LO', cause: { vi: 'Áp hơi thổi bụi thấp', en: 'Soot-blow steam pressure low' }, responseTimeSec: 600, priorityBasis: { vi: 'Thổi bụi kém hiệu quả', en: 'Ineffective soot blowing' }, reviewed: true },
  { alarmId: 'WTP-DM-COND-HI', cause: { vi: 'Trao đổi ion cạn / rò', en: 'Ion-exchange exhausted / leak' }, responseTimeSec: 600, priorityBasis: { vi: 'Nước cấp nhiễm khoáng → cáu cặn', en: 'Contaminated makeup causes scaling' }, reviewed: true },
  { alarmId: 'EMG-STATION-BLACKOUT', cause: { vi: 'Mất điện tự dùng toàn trạm', en: 'Total station auxiliary blackout' }, responseTimeSec: 30, priorityBasis: { vi: 'Mất mọi thiết bị phụ → an toàn', en: 'Loss of all auxiliaries; safety' }, reviewed: true },
  { alarmId: 'SWY-LINE-TRIP', cause: { vi: 'Sự cố đường dây 500 kV', en: '500 kV line fault' }, responseTimeSec: 60, priorityBasis: { vi: 'Mất lối xuất công suất', en: 'Loss of power export path' }, reviewed: true },
  { alarmId: 'HVAC-CR-TEMP-HI', cause: { vi: 'Hỏng điều hoà phòng điều khiển', en: 'Control-room AC failure' }, responseTimeSec: 1800, priorityBasis: { vi: 'Quá nhiệt thiết bị điều khiển', en: 'Control equipment overheat' }, reviewed: true },
  { alarmId: 'FIRE-DETECTED', cause: { vi: 'Phát hiện cháy (khói/nhiệt/lửa)', en: 'Fire detected (smoke/heat/flame)' }, responseTimeSec: 30, priorityBasis: { vi: 'An toàn người & tài sản', en: 'Life & asset safety' }, reviewed: true },
  { alarmId: 'CHEM-FW-PH-LO', cause: { vi: 'Hụt hoá chất điều hoà pH', en: 'pH conditioning chemical short' }, responseTimeSec: 600, priorityBasis: { vi: 'Ăn mòn chu trình nước-hơi', en: 'Water-steam cycle corrosion' }, reviewed: true },
  { alarmId: 'CA-IA-PRESS-LO', cause: { vi: 'Mất máy nén khí điều khiển', en: 'Instrument-air compressor loss' }, responseTimeSec: 120, priorityBasis: { vi: 'Van khí nén mất điều khiển', en: 'Pneumatic valves lose control' }, reviewed: true },
];

/** Báo cáo rationalization (ISA-18.2 + EEMUA-191) — gộp AlarmDef × bản ghi rationalization. */
export interface AlarmRationalizationReport {
  total: number;
  rationalized: number; // số alarm có bản ghi rationalization
  reviewed: number; // số alarm đã duyệt
  coveragePct: number; // % độ phủ rationalization
  distribution: Record<Priority, number>; // đếm theo ưu tiên
  distributionPct: Record<Priority, number>; // % theo ưu tiên
  eemuaTarget: Readonly<Record<'P1' | 'P2' | 'P3', number>>;
  distributionOk: boolean; // P1 share ≤ ngưỡng (phân bố hợp lý)
  unrationalized: ReadonlyArray<string>; // alarmId thiếu bản ghi
  master: ReadonlyArray<{
    alarmId: string;
    priority: Priority;
    cause: { vi: string; en: string };
    consequence: { vi: string; en: string };
    corrective?: { vi: string; en: string };
    responseTimeSec: number;
    priorityBasis: { vi: string; en: string };
    suppressWhen?: string;
    reviewed: boolean;
  }>;
}

/** Gộp danh mục alarm với bản ghi rationalization → báo cáo master + KPI phân bố. Hàm THUẦN (tất định). */
export function buildAlarmRationalization(
  alarms: ReadonlyArray<AlarmDef>,
  rats: ReadonlyArray<AlarmRationalization> = thermalAlarmRationalization,
): AlarmRationalizationReport {
  const ratById = new Map(rats.map((r) => [r.alarmId, r]));
  const distribution: Record<Priority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const unrationalized: string[] = [];
  let rationalized = 0;
  let reviewed = 0;
  const master = alarms.map((a) => {
    const r = ratById.get(a.alarmId);
    distribution[a.priority] += 1;
    if (r) {
      rationalized += 1;
      if (r.reviewed) reviewed += 1;
    } else {
      unrationalized.push(a.alarmId);
    }
    return {
      alarmId: a.alarmId,
      priority: a.priority,
      cause: r?.cause ?? { vi: '(chưa rationalize)', en: '(unrationalized)' },
      consequence: a.consequence,
      corrective: a.corrective,
      responseTimeSec: r?.responseTimeSec ?? -1,
      priorityBasis: r?.priorityBasis ?? { vi: '(chưa rationalize)', en: '(unrationalized)' },
      suppressWhen: a.suppressWhen,
      reviewed: r?.reviewed ?? false,
    };
  });
  const total = alarms.length;
  const pct = (n: number): number => (total > 0 ? (n / total) * 100 : 0);
  const distributionPct: Record<Priority, number> = {
    P1: pct(distribution.P1), P2: pct(distribution.P2), P3: pct(distribution.P3), P4: pct(distribution.P4),
  };
  return {
    total,
    rationalized,
    reviewed,
    coveragePct: pct(rationalized),
    distribution,
    distributionPct,
    eemuaTarget: EEMUA_PRIORITY_TARGET,
    distributionOk: distributionPct.P1 <= P1_SHARE_MAX_PCT,
    unrationalized,
    master,
  };
}
