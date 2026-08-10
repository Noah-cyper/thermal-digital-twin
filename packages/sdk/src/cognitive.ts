// @idtp/sdk — Lớp AI Cognitive / Predictive Maintenance (doc 20 §Cognitive). Kiến trúc ADAPTER:
// kernel/plugin khai báo SPEC sức khoẻ tài sản (declarative); một CognitiveMaintenanceProvider suy ra
// ĐÁNH GIÁ. Nhiều nguồn cùng một chữ ký: SimulationCognitiveMaintenanceProvider (nội bộ, dùng NGAY) và
// GroundupCognitiveMaintenanceProvider (dịch vụ ngoài, TƯƠNG LAI — chưa cấu hình thì KHÔNG bịa dữ liệu).
//
// READ-ONLY TUYỆT ĐỐI: chỉ đọc tag/giờ chạy, KHÔNG ghi tag/setpoint/ACK (nhất quán AI Advisor doc 20).
// MINH BẠCH: điểm sức khoẻ = tổng có trọng số các tín hiệu, PHƠI BÀY đóng góp từng tín hiệu (không hộp
// đen). RUL luôn gắn nhãn `simulated: true`. Mọi số ngoài Design Basis là [GIẢ ĐỊNH] (ghi tài liệu 25).
import type { TagId, Iso8601 } from './types';

type Text = { vi: string; en: string };

/** Nhóm thiết bị — ánh xạ khái niệm "machine" của cognitive maintenance sang thiết bị nhà máy THẬT. */
export type AssetKind =
  | 'pump'
  | 'fan'
  | 'mill'
  | 'turbine-generator'
  | 'compressor'
  | 'heat-exchanger'
  | 'tank'
  | 'valve'
  | 'transformer'
  | 'other';

/** Dải sức khoẻ suy từ điểm 0..100 (ngưỡng ở COGNITIVE_HEALTH_BANDS — [GIẢ ĐỊNH]). */
export type HealthBand = 'healthy' | 'watch' | 'warning' | 'critical';

/**
 * Một TÍN HIỆU sức khoẻ khai báo: ánh xạ giá trị tag → độ lành mạnh 0..1 tuyến tính giữa good↔bad.
 * Hướng suy ra từ good vs bad (good<bad ⇒ TĂNG là xấu; good>bad ⇒ GIẢM là xấu) — không cần cờ riêng.
 */
export interface HealthSignalSpec {
  readonly tag: TagId;
  readonly label: Text;
  /** Giá trị coi là HOÀN TOÀN lành mạnh (goodness = 1). */
  readonly good: number;
  /** Giá trị coi là HỎNG hoàn toàn (goodness = 0). */
  readonly bad: number;
  /** Trọng số đóng góp thô (chuẩn hoá nội bộ theo tổng trọng số của tài sản). */
  readonly weight: number;
  readonly unit?: string;
  /** Ngưỡng goodness coi là BẤT THƯỜNG (mặc định COGNITIVE_ANOMALY_BELOW). */
  readonly anomalyBelow?: number;
}

/** SPEC sức khoẻ MỘT tài sản — plugin/kernel cung cấp dưới dạng dữ liệu khai báo (gói P2 điền số thực). */
export interface AssetHealthSpec {
  readonly assetId: string;
  readonly name: Text;
  readonly kind: AssetKind;
  /** Tag run-state (>0,5 = đang chạy) để liên kết giờ chạy / RUL theo tuổi thọ. */
  readonly runTag?: TagId;
  readonly signals: ReadonlyArray<HealthSignalSpec>;
  /** Tuổi thọ thiết kế (giờ chạy) — cơ sở RUL theo giờ chạy. [GIẢ ĐỊNH] nếu ngoài Design Basis. */
  readonly designLifeH?: number;
}

/** Đóng góp MINH BẠCH của một tín hiệu vào điểm sức khoẻ (phơi bày để không phải hộp đen). */
export interface HealthFactor {
  readonly tag: TagId;
  readonly label: Text;
  readonly value: number;
  readonly goodness: number; // 0..1
  readonly weight: number; // trọng số ĐÃ chuẩn hoá (tổng mọi factor = 1)
  readonly contribution: number; // goodness × weight × 100 — điểm tín hiệu này góp vào 0..100
  readonly unit?: string;
}

/** Điểm sức khoẻ máy (0..100) kèm phân rã theo tín hiệu. */
export interface MachineHealth {
  readonly assetId: string;
  readonly name: Text;
  readonly kind: AssetKind;
  readonly score: number; // 0..100
  readonly band: HealthBand;
  readonly factors: ReadonlyArray<HealthFactor>;
}

export type AnomalySeverity = 'info' | 'warn' | 'alert';

/** Bất thường phát hiện được trên một tín hiệu (goodness dưới ngưỡng). */
export interface Anomaly {
  readonly assetId: string;
  readonly tag: TagId;
  readonly label: Text;
  readonly severity: AnomalySeverity;
  readonly value: number;
  readonly goodness: number; // 0..1 (càng thấp lệch càng nhiều)
  readonly description: string;
}

/** Một giả thuyết nguyên nhân gốc kèm XÁC SUẤT tương đối (0..1) — tổng các giả thuyết = 1. */
export interface RootCauseHypothesis {
  readonly label: string;
  readonly probability: number; // 0..1
  readonly evidence: ReadonlyArray<string>;
}

/** Giải thích WHAT / WHY / HOW cho panel AI (điều gì · vì sao · nên làm gì). */
export interface Diagnosis {
  readonly assetId: string;
  readonly what: string;
  readonly why: string;
  readonly how: string;
  readonly rootCauses: ReadonlyArray<RootCauseHypothesis>;
}

/** Tuổi thọ còn lại — LUÔN gắn nhãn mô phỏng (không phải RUL đo thực từ thiết bị). */
export interface RemainingUsefulLife {
  readonly assetId: string;
  readonly hours: number | null; // null nếu thiếu dữ liệu xu hướng/tuổi thọ
  readonly confidence: 'low' | 'medium' | 'high';
  readonly basis: string; // cơ sở suy luận (xu hướng tín hiệu / giờ chạy vs tuổi thọ)
  readonly simulated: true; // BẤT BIẾN: RUL MÔ PHỎNG, không được coi là số đo thực
}

export type RecommendationPriority = 'routine' | 'planned' | 'urgent';

export interface MaintenanceRecommendation {
  readonly assetId: string;
  readonly action: string;
  readonly priority: RecommendationPriority;
  readonly rationale: string;
}

/** Đánh giá cognitive đầy đủ cho một tài sản. */
export interface CognitiveAssessment {
  readonly health: MachineHealth;
  readonly anomalies: ReadonlyArray<Anomaly>;
  readonly diagnosis: Diagnosis | null; // null khi lành mạnh (không có gì để chẩn đoán)
  readonly rul: RemainingUsefulLife;
  readonly recommendations: ReadonlyArray<MaintenanceRecommendation>;
}

/** Tổng quan sức khoẻ toàn nhà máy (fleet). */
export interface FleetCognitiveOverview {
  readonly generatedTs: Iso8601; // theo đồng hồ SIM (không Date.now)
  readonly assets: ReadonlyArray<MachineHealth>;
  readonly worst: ReadonlyArray<{ readonly assetId: string; readonly score: number; readonly band: HealthBand }>;
  readonly anomalyCount: number;
  readonly averageScore: number; // trung bình điểm sức khoẻ 0..100
}

/**
 * Ngữ cảnh runtime CHỈ ĐỌC truyền vào provider mỗi lần đánh giá. Không có setter (read-only đối với
 * process). `formatTs` dùng đồng hồ SIM để không gọi Date.now trong vòng.
 */
export interface CognitiveInput {
  readonly nowMs: number;
  getTag(tag: TagId): number;
  /** Giờ chạy tích luỹ của tài sản (từ Maintenance Engine); 0 nếu không theo dõi. */
  runningHours(assetId: string): number;
  formatTs(ms: number): Iso8601;
}

/**
 * Chế độ nguồn đánh giá — PHƠI BÀY để HMI gắn nhãn TRUNG THỰC, không giả mạo:
 *  - 'simulation'    : suy từ mô phỏng vật lý tất định nội bộ (mặc định hiện tại).
 *  - 'external-demo' : adapter tới dịch vụ ngoài NHƯNG CHƯA cấu hình → CHẾ ĐỘ DEMO, KHÔNG kết nối thật.
 *  - 'external-live' : adapter tới dịch vụ ngoài đã cấu hình thật (chưa khả dụng ở bản này).
 */
export type CognitiveProviderMode = 'simulation' | 'external-demo' | 'external-live';

export interface CognitiveProviderInfo {
  readonly id: string;
  readonly name: string;
  readonly mode: CognitiveProviderMode;
  /** true nếu provider trả được đánh giá thật; false → chỉ khai báo, KHÔNG bịa dữ liệu. */
  readonly available: boolean;
  /** Nhãn hiển thị trung thực cho người dùng (vd "Chế độ Mô phỏng / Demo"). */
  readonly notice: Text;
}

/**
 * ADAPTER cognitive maintenance — nhiều nguồn (mô phỏng nội bộ NOW · Groundup FUTURE) cùng chữ ký.
 * READ-ONLY tuyệt đối. Provider KHÔNG khả dụng phải trả undefined/mảng rỗng — TUYỆT ĐỐI không bịa dữ liệu.
 */
export interface CognitiveMaintenanceProvider {
  readonly info: CognitiveProviderInfo;
  /** assetId provider phủ (rỗng nếu không khả dụng). */
  assets(): ReadonlyArray<string>;
  assess(assetId: string, input: CognitiveInput): CognitiveAssessment | undefined;
  detectAnomalies(assetId: string, input: CognitiveInput): ReadonlyArray<Anomaly>;
  diagnose(assetId: string, input: CognitiveInput): Diagnosis | undefined;
  estimateRul(assetId: string, input: CognitiveInput): RemainingUsefulLife | undefined;
  recommend(assetId: string, input: CognitiveInput): ReadonlyArray<MaintenanceRecommendation>;
  fleetOverview(input: CognitiveInput): FleetCognitiveOverview;
}

/** Ngưỡng dải sức khoẻ (điểm ≥ ngưỡng → dải đó). [GIẢ ĐỊNH] — tài liệu 25 GĐ-140. */
export const COGNITIVE_HEALTH_BANDS: { readonly healthy: number; readonly watch: number; readonly warning: number } = {
  healthy: 85,
  watch: 65,
  warning: 40,
};

/** Ngưỡng goodness mặc định coi là bất thường. [GIẢ ĐỊNH] — tài liệu 25 GĐ-140. */
export const COGNITIVE_ANOMALY_BELOW = 0.5;

/** Suy dải sức khoẻ từ điểm 0..100 theo COGNITIVE_HEALTH_BANDS. */
export function healthBandFor(score: number): HealthBand {
  if (score >= COGNITIVE_HEALTH_BANDS.healthy) return 'healthy';
  if (score >= COGNITIVE_HEALTH_BANDS.watch) return 'watch';
  if (score >= COGNITIVE_HEALTH_BANDS.warning) return 'warning';
  return 'critical';
}
