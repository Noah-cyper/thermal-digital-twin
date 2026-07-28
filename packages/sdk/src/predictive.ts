// @idtp/sdk — luật BẢO TRÌ DỰ ĐOÁN KHAI BÁO (doc 05-18 / doc 20). Plugin CUNG CẤP luật; engine
// PredictiveMaintenance (@idtp/engines) đánh giá (rule-based v1, READ-ONLY): cảnh báo SỚM từ ngưỡng,
// xu hướng (rate → dự báo thời điểm vượt), và giờ chạy tới hạn PM. ML/AI dự đoán thật = v3.
import type { TagId } from './types';

export type PredictiveKind = 'threshold' | 'trend' | 'runhours';
export type PredictiveSeverity = 'info' | 'warn' | 'alert';

export interface PredictiveRule {
  readonly ruleId: string;
  readonly assetId: string;
  readonly kind: PredictiveKind;
  readonly tag?: TagId; // threshold/trend
  readonly warn?: number; // threshold: ngưỡng cảnh báo
  readonly limit?: number; // threshold/trend: ngưỡng nguy hiểm / đích dự báo
  readonly horizonH?: number; // trend/runhours: chân trời cảnh báo (giờ)
  readonly pmHours?: number; // runhours: mốc bảo dưỡng định kỳ
  readonly title: { vi: string; en: string };
}

export interface PredictiveAdvisory {
  readonly ruleId: string;
  readonly assetId: string;
  readonly severity: PredictiveSeverity;
  readonly message: string;
  readonly metric: number; // giá trị/tham số liên quan
  readonly projectionH: number | null; // giờ dự báo tới ngưỡng (null nếu không áp dụng)
}
