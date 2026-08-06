// Plugin thermal-power-600 — luật BẢO TRÌ DỰ ĐOÁN (doc 05-18). DỮ LIỆU thuần. Tham chiếu tag sim +
// asset bảo trì thật. Ngưỡng/mốc PM ngoài Design Basis = [GIẢ ĐỊNH] (GĐ-38 vacuum, GĐ-40 PM, GĐ-57).
// Ở điểm vận hành ổn định: không cảnh báo; khi tham số trôi (vd mất chân không) → cảnh báo sớm.
import type { PredictiveRule } from '@idtp/sdk';

export const thermalPredictiveRules: ReadonlyArray<PredictiveRule> = [
  { ruleId: 'PRD-VAC-TREND', assetId: 'UNIT1', kind: 'trend', tag: 'TRB_COND_VACUUM_01', limit: 20, horizonH: 48, title: { vi: 'Chân không bình ngưng', en: 'Condenser vacuum' } },
  { ruleId: 'PRD-VAC-THR', assetId: 'UNIT1', kind: 'threshold', tag: 'TRB_COND_VACUUM_01', warn: 12, limit: 20, title: { vi: 'Chân không bình ngưng', en: 'Condenser vacuum' } },
  { ruleId: 'PRD-SHTEMP-TREND', assetId: 'UNIT1', kind: 'trend', tag: 'BLR_MSTM_SH_TEMP_01', limit: 551, horizonH: 24, title: { vi: 'Nhiệt độ hơi SH', en: 'SH steam temperature' } },
  { ruleId: 'PRD-PM-UNIT1', assetId: 'UNIT1', kind: 'runhours', pmHours: 8000, horizonH: 500, title: { vi: 'Bảo dưỡng định kỳ UNIT1', en: 'UNIT1 preventive maintenance' } },
  { ruleId: 'PRD-PM-MILL', assetId: 'MILL_GROUP', kind: 'runhours', pmHours: 2000, horizonH: 200, title: { vi: 'Bảo dưỡng nhóm máy nghiền', en: 'Mill group PM' } },
  // Chẩn đoán → dự báo cho các hệ chiều sâu (v1.64): tag TĂNG khi xấu → khớp ngữ nghĩa threshold/trend
  // (v ≥ warn/limit). Điểm vận hành mọi tag dưới warn → 0 cảnh báo giả.
  { ruleId: 'PRD-TSE-STRESS', assetId: 'UNIT1', kind: 'threshold', tag: 'TSE_STRESS_PCT_01', warn: 70, limit: 90, title: { vi: 'Ứng suất nhiệt rotor turbine', en: 'Turbine rotor thermal stress' } },
  { ruleId: 'PRD-TSE-LIFE', assetId: 'UNIT1', kind: 'trend', tag: 'TSE_LIFE_USED_01', limit: 1.0, horizonH: 500, title: { vi: 'Tiêu hao tuổi thọ rotor', en: 'Rotor life expenditure' } },
  { ruleId: 'PRD-COND-PENALTY', assetId: 'UNIT1', kind: 'threshold', tag: 'CNDP_HR_PENALTY_01', warn: 1.0, limit: 2.5, title: { vi: 'Phạt heat rate bình ngưng', en: 'Condenser heat-rate penalty' } },
  { ruleId: 'PRD-COND-BPDEV', assetId: 'UNIT1', kind: 'trend', tag: 'CNDP_BP_DEVIATION_01', limit: 1.5, horizonH: 72, title: { vi: 'Bám bẩn bình ngưng (back-pressure)', en: 'Condenser fouling (back-pressure)' } },
  { ruleId: 'PRD-GEN-LOADING', assetId: 'UNIT1', kind: 'threshold', tag: 'GCAP_MVA_LOADING_01', warn: 90, limit: 100, title: { vi: 'Tải MVA máy phát', en: 'Generator MVA loading' } },
];
