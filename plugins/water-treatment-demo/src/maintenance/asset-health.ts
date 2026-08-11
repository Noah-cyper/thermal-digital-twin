// Plugin water-treatment-demo — SỔ ĐĂNG KÝ SỨC KHOẺ TÀI SẢN (doc 20 §Cognitive). CHỨNG MINH lớp AI
// cognitive maintenance là GENERIC: cùng contract AssetHealthSpec + engine SimulationCognitiveMaintenance
// Provider mà thermal-power-600 dùng — nhà máy NƯỚC chỉ khai báo tài sản/tín hiệu của mình, 0 dòng engine
// riêng. Dữ liệu THUẦN KHAI BÁO, tag đã mô phỏng. good/bad/weight/designLifeH = [GIẢ ĐỊNH] (doc 25).
import type { AssetHealthSpec } from '@idtp/sdk';

export const waterAssetHealth: ReadonlyArray<AssetHealthSpec> = [
  {
    assetId: 'RO-MEMBRANE',
    name: { vi: 'Màng thẩm thấu ngược (RO)', en: 'RO Membrane' },
    kind: 'other',
    designLifeH: 26280, // ~3 năm tuổi thọ màng
    signals: [
      { tag: 'WTP_RO_SALT_REJECT_01', label: { vi: 'Độ khử muối', en: 'Salt rejection' }, good: 99, bad: 95, weight: 3, unit: '%' },
      { tag: 'WTP_RO_PERM_COND_01', label: { vi: 'Độ dẫn permeate', en: 'Permeate conductivity' }, good: 4, bad: 25, weight: 2, unit: 'µS/cm' },
      { tag: 'WTP_RO_DP_01', label: { vi: 'Chênh áp (bám bẩn)', en: 'Differential pressure (fouling)' }, good: 1.5, bad: 4, weight: 2, unit: 'bar' },
      { tag: 'WTP_RO_PERMEATE_FLOW_01', label: { vi: 'Lưu lượng permeate', en: 'Permeate flow' }, good: 110, bad: 60, weight: 1, unit: 'm³/h' },
    ],
  },
  {
    assetId: 'FEED-PUMP',
    name: { vi: 'Bơm cấp cao áp RO', en: 'RO High-Pressure Feed Pump' },
    kind: 'pump',
    runTag: 'WTP_PUMP_A_RUN',
    designLifeH: 40000,
    signals: [{ tag: 'WTP_RO_FEED_PRESS_01', label: { vi: 'Áp cấp RO', en: 'RO feed pressure' }, good: 15, bad: 10, weight: 2, unit: 'bar' }],
  },
];
