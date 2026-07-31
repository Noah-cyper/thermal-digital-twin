// Plugin thermal-power-600 — ma trận CAUSE & EFFECT KHAI BÁO (doc 09 §4, NFPA 85 / turbine trip).
// DỮ LIỆU thuần. Nguyên nhân trên tag sim (bất hoạt ở điểm vận hành: drum≈0 · furnace≈−50 · áp≈17,5 ·
// vacuum≈5,4). Ngưỡng neo Design Basis §3.2/§3.3; ngưỡng ngoài Design Basis = [GIẢ ĐỊNH] (GĐ-47).
import type { CauseEffectMatrix } from '@idtp/sdk';

export const thermalCauseEffect: ReadonlyArray<CauseEffectMatrix> = [
  {
    matrixId: 'boiler-mft',
    title: { vi: 'Master Fuel Trip (NFPA 85)', en: 'Master Fuel Trip (NFPA 85)' },
    causes: [
      { id: 'drum-ll', tag: 'BLR_DRUM_LEVEL_01', op: 'lt', value: -250, title: { vi: 'Mức bao hơi LL', en: 'Drum level LL' } },
      { id: 'drum-hh', tag: 'BLR_DRUM_LEVEL_01', op: 'gt', value: 250, title: { vi: 'Mức bao hơi HH', en: 'Drum level HH' } },
      { id: 'furnace-hh', tag: 'BLR_FURN_PRESS_01', op: 'gt', value: 200, title: { vi: 'Áp buồng lửa HH', en: 'Furnace pressure HH' } },
      { id: 'furnace-ll', tag: 'BLR_FURN_PRESS_01', op: 'lt', value: -200, title: { vi: 'Áp buồng lửa LL', en: 'Furnace pressure LL' } },
      { id: 'ms-press-hh', tag: 'BLR_MSTM_SH_PRESS_01', op: 'gt', value: 19.3, title: { vi: 'Áp hơi chính HH', en: 'Main steam pressure HH' } },
      { id: 'manual-mft', tag: 'BLR_MFT_PB', op: 'gt', value: 0, title: { vi: 'Nút MFT tay', en: 'Manual MFT pushbutton' } },
    ],
    effects: [
      { id: 'trip-fuel', tag: 'BLR_MFT_TRIP', value: 1, title: { vi: 'Cắt toàn bộ nhiên liệu', en: 'Trip all fuel' } },
      { id: 'trip-mills', tag: 'BLR_MILLS_TRIP', value: 1, title: { vi: 'Trip toàn bộ mill', en: 'Trip all mills' } },
      { id: 'trip-pa', tag: 'BLR_PA_FANS_TRIP', value: 1, title: { vi: 'Trip quạt PA', en: 'Trip PA fans' } },
      { id: 'close-fuel-valves', tag: 'BLR_FUEL_VALVES_CLOSE', value: 1, title: { vi: 'Đóng van nhiên liệu', en: 'Close fuel valves' } },
    ],
    // MFT = trip mọi thứ: mỗi nguyên nhân → cả 4 hệ quả.
    cells: (['drum-ll', 'drum-hh', 'furnace-hh', 'furnace-ll', 'ms-press-hh', 'manual-mft'] as const).flatMap((cause) =>
      (['trip-fuel', 'trip-mills', 'trip-pa', 'close-fuel-valves'] as const).map((effect) => ({ cause, effect })),
    ),
  },
  {
    matrixId: 'turbine-trip',
    title: { vi: 'Turbine trip', en: 'Turbine trip' },
    causes: [
      { id: 'low-vacuum', tag: 'TRB_COND_VACUUM_01', op: 'gt', value: 20, title: { vi: 'Mất chân không bình ngưng', en: 'Loss of condenser vacuum' } },
      { id: 'ms-press-hh', tag: 'BLR_MSTM_SH_PRESS_01', op: 'gt', value: 19.3, title: { vi: 'Quá áp hơi chính', en: 'Main steam overpressure' } },
      { id: 'manual-trip', tag: 'TRB_TRIP_PB', op: 'gt', value: 0, title: { vi: 'Nút trip turbine tay', en: 'Manual turbine trip' } },
    ],
    effects: [
      { id: 'trip-turbine', tag: 'TRB_TRIP', value: 1, title: { vi: 'Trip turbine', en: 'Trip turbine' } },
      { id: 'close-msv', tag: 'TRB_MSV_CLOSE', value: 1, title: { vi: 'Đóng van stop chính', en: 'Close main stop valve' } },
      { id: 'gen-breaker', tag: 'GEN_BREAKER_TRIP', value: 1, title: { vi: 'Mở máy cắt máy phát', en: 'Open generator breaker' } },
    ],
    // Turbine trip → đóng MSV (turbine coast-down) + mở máy cắt máy phát (tách lưới, tổ máy nhập tự dùng).
    cells: [
      { cause: 'low-vacuum', effect: 'trip-turbine' },
      { cause: 'low-vacuum', effect: 'close-msv' },
      { cause: 'low-vacuum', effect: 'gen-breaker' },
      { cause: 'ms-press-hh', effect: 'trip-turbine' },
      { cause: 'ms-press-hh', effect: 'gen-breaker' },
      { cause: 'manual-trip', effect: 'trip-turbine' },
      { cause: 'manual-trip', effect: 'close-msv' },
      { cause: 'manual-trip', effect: 'gen-breaker' },
    ],
  },
];
