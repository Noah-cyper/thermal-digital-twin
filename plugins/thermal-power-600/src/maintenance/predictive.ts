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
];
