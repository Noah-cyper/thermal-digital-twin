// L2 — AI Cognitive / Predictive Maintenance PROVIDER (doc 20 §Cognitive). ADAPTER read-only: đọc
// SPEC sức khoẻ tài sản (khai báo) + tag → suy ĐÁNH GIÁ minh bạch (điểm = tổng có trọng số, phơi bày
// đóng góp từng tín hiệu). Hai nguồn cùng chữ ký CognitiveMaintenanceProvider:
//   • SimulationCognitiveMaintenanceProvider — suy từ mô phỏng vật lý tất định NỘI BỘ (dùng NGAY).
//   • GroundupCognitiveMaintenanceProvider   — seam dịch vụ NGOÀI (TƯƠNG LAI): chưa cấu hình → decline
//     sạch (available:false), TUYỆT ĐỐI không bịa dữ liệu, không import/giả SDK.
// READ-ONLY tuyệt đối, tất định (không Math.random/Date.now — thời gian lấy từ CognitiveInput.nowMs).
import type {
  AssetHealthSpec,
  HealthSignalSpec,
  MachineHealth,
  HealthFactor,
  Anomaly,
  AnomalySeverity,
  Diagnosis,
  RootCauseHypothesis,
  RemainingUsefulLife,
  MaintenanceRecommendation,
  RecommendationPriority,
  CognitiveAssessment,
  FleetCognitiveOverview,
  CognitiveInput,
  CognitiveMaintenanceProvider,
  CognitiveProviderInfo,
  HealthBand,
  PredictiveRule,
  PredictiveAdvisory,
} from '@idtp/sdk';
import { COGNITIVE_ANOMALY_BELOW, healthBandFor } from '@idtp/sdk';
import { PredictiveMaintenance } from './predictive-maintenance';

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

const BAND_VI: Record<HealthBand, string> = {
  healthy: 'lành mạnh',
  watch: 'theo dõi',
  warning: 'cảnh báo',
  critical: 'nguy cấp',
};

/** Chi tiết một tín hiệu sau khi đánh giá — dùng lại cho anomaly/diagnosis/recommendation. */
interface SignalDetail {
  readonly spec: HealthSignalSpec;
  readonly value: number;
  readonly goodness: number; // 0..1
  readonly normWeight: number; // trọng số đã chuẩn hoá (tổng = 1)
  readonly threshold: number; // ngưỡng bất thường hiệu dụng
}

const anomalySeverity = (goodness: number): AnomalySeverity => (goodness < 0.2 ? 'alert' : goodness < 0.4 ? 'warn' : 'info');
const priorityForGoodness = (goodness: number): RecommendationPriority => (goodness < 0.2 ? 'urgent' : goodness < 0.4 ? 'planned' : 'routine');
const priorityForBand = (band: HealthBand): RecommendationPriority => (band === 'critical' ? 'urgent' : band === 'warning' ? 'planned' : 'routine');

/**
 * Provider MÔ PHỎNG: suy đánh giá cognitive từ SPEC + tag hiện tại (tất định, read-only). RUL xu hướng
 * mượn PredictiveMaintenance (rule trend) — CHẠY 1 LẦN / nowMs (memo) vì engine giữ trạng thái rate.
 */
export class SimulationCognitiveMaintenanceProvider implements CognitiveMaintenanceProvider {
  readonly info: CognitiveProviderInfo = {
    id: 'idtp-sim-cognitive',
    name: 'IDTP Simulation Cognitive Maintenance',
    mode: 'simulation',
    available: true,
    notice: {
      vi: 'Chế độ Mô phỏng / Demo — suy từ mô phỏng vật lý tất định nội bộ, KHÔNG phải số đo thiết bị thật.',
      en: 'Simulation / Demo mode — inferred from internal deterministic physics, NOT real device measurements.',
    },
  };

  private readonly specs = new Map<string, AssetHealthSpec>();
  private readonly predictive: PredictiveMaintenance;
  private memoMs = Number.NaN;
  private memoAdv: ReadonlyArray<PredictiveAdvisory> = [];

  constructor(opts: { specs: ReadonlyArray<AssetHealthSpec>; rules?: ReadonlyArray<PredictiveRule> }) {
    for (const s of opts.specs) this.specs.set(s.assetId, s);
    this.predictive = new PredictiveMaintenance(opts.rules ?? []);
  }

  assets(): ReadonlyArray<string> {
    return [...this.specs.keys()];
  }

  assess(assetId: string, input: CognitiveInput): CognitiveAssessment | undefined {
    const spec = this.specs.get(assetId);
    if (!spec) return undefined;
    const { health, detail } = this.evalHealth(spec, input);
    const anomalies = this.buildAnomalies(spec.assetId, detail);
    const advisories = this.ensureAdvisories(input);
    const diagnosis = health.band === 'healthy' ? null : this.buildDiagnosis(spec, health, detail, advisories);
    const rul = this.buildRul(spec, input, advisories);
    const recommendations = this.buildRecommendations(spec, health, detail);
    return { health, anomalies, diagnosis, rul, recommendations };
  }

  detectAnomalies(assetId: string, input: CognitiveInput): ReadonlyArray<Anomaly> {
    const spec = this.specs.get(assetId);
    if (!spec) return [];
    return this.buildAnomalies(spec.assetId, this.evalHealth(spec, input).detail);
  }

  diagnose(assetId: string, input: CognitiveInput): Diagnosis | undefined {
    const spec = this.specs.get(assetId);
    if (!spec) return undefined;
    const { health, detail } = this.evalHealth(spec, input);
    if (health.band === 'healthy') return undefined;
    return this.buildDiagnosis(spec, health, detail, this.ensureAdvisories(input));
  }

  estimateRul(assetId: string, input: CognitiveInput): RemainingUsefulLife | undefined {
    const spec = this.specs.get(assetId);
    if (!spec) return undefined;
    return this.buildRul(spec, input, this.ensureAdvisories(input));
  }

  recommend(assetId: string, input: CognitiveInput): ReadonlyArray<MaintenanceRecommendation> {
    const spec = this.specs.get(assetId);
    if (!spec) return [];
    const { health, detail } = this.evalHealth(spec, input);
    return this.buildRecommendations(spec, health, detail);
  }

  fleetOverview(input: CognitiveInput): FleetCognitiveOverview {
    const assets: MachineHealth[] = [];
    let anomalyCount = 0;
    let sum = 0;
    for (const spec of this.specs.values()) {
      const { health, detail } = this.evalHealth(spec, input);
      assets.push(health);
      anomalyCount += this.buildAnomalies(spec.assetId, detail).length;
      sum += health.score;
    }
    const worst = assets
      .map((a) => ({ assetId: a.assetId, score: a.score, band: a.band }))
      .sort((x, y) => x.score - y.score);
    const averageScore = assets.length > 0 ? sum / assets.length : 0;
    return {
      generatedTs: input.formatTs(input.nowMs),
      assets,
      worst,
      anomalyCount,
      averageScore,
    };
  }

  // ── nội bộ ──────────────────────────────────────────────────────────────────
  private ensureAdvisories(input: CognitiveInput): ReadonlyArray<PredictiveAdvisory> {
    if (input.nowMs !== this.memoMs) {
      this.memoMs = input.nowMs;
      this.memoAdv = this.predictive.evaluate({
        nowMs: input.nowMs,
        getTag: (t) => input.getTag(t),
        runningHours: (a) => input.runningHours(a),
      });
    }
    return this.memoAdv;
  }

  private evalHealth(spec: AssetHealthSpec, input: CognitiveInput): { health: MachineHealth; detail: SignalDetail[] } {
    const totalW = spec.signals.reduce((s: number, sig: HealthSignalSpec) => s + (sig.weight > 0 ? sig.weight : 0), 0);
    const n = spec.signals.length;
    const detail: SignalDetail[] = spec.signals.map((sig: HealthSignalSpec) => {
      const value = input.getTag(sig.tag);
      const goodness = sig.good === sig.bad ? 1 : clamp01((value - sig.bad) / (sig.good - sig.bad));
      const normWeight = totalW > 0 ? (sig.weight > 0 ? sig.weight : 0) / totalW : n > 0 ? 1 / n : 0;
      const threshold = sig.anomalyBelow ?? COGNITIVE_ANOMALY_BELOW;
      return { spec: sig, value, goodness, normWeight, threshold };
    });
    const factors: HealthFactor[] = detail.map((d) => ({
      tag: d.spec.tag,
      label: d.spec.label,
      value: d.value,
      goodness: d.goodness,
      weight: d.normWeight,
      contribution: d.goodness * d.normWeight * 100,
      unit: d.spec.unit,
    }));
    const score = factors.reduce((s, f) => s + f.contribution, 0);
    const band = healthBandFor(score);
    return { health: { assetId: spec.assetId, name: spec.name, kind: spec.kind, score, band, factors }, detail };
  }

  private buildAnomalies(assetId: string, detail: ReadonlyArray<SignalDetail>): Anomaly[] {
    const out: Anomaly[] = [];
    for (const d of detail) {
      if (d.goodness >= d.threshold) continue;
      out.push({
        assetId,
        tag: d.spec.tag,
        label: d.spec.label,
        severity: anomalySeverity(d.goodness),
        value: d.value,
        goodness: d.goodness,
        description: `${d.spec.label.vi}: ${d.value.toFixed(2)}${d.spec.unit ? ' ' + d.spec.unit : ''} — độ lành mạnh ${(d.goodness * 100).toFixed(0)}% (dưới ngưỡng ${(d.threshold * 100).toFixed(0)}%)`,
      });
    }
    return out.sort((a, b) => a.goodness - b.goodness);
  }

  private buildDiagnosis(
    spec: AssetHealthSpec,
    health: MachineHealth,
    detail: ReadonlyArray<SignalDetail>,
    advisories: ReadonlyArray<PredictiveAdvisory>,
  ): Diagnosis {
    // Nguyên nhân gốc: xác suất ∝ (1 − goodness) × weight thô, chuẩn hoá tổng = 1.
    const raw = detail
      .map((d) => ({ d, w: (1 - d.goodness) * d.spec.weight }))
      .filter((r) => r.w > 0);
    const rawTotal = raw.reduce((s, r) => s + r.w, 0);
    const rootCauses: RootCauseHypothesis[] = raw
      .map((r) => ({
        label: `${r.d.spec.label.vi} suy giảm`,
        probability: rawTotal > 0 ? r.w / rawTotal : 0,
        evidence: [
          `${r.d.spec.tag} = ${r.d.value.toFixed(2)}${r.d.spec.unit ? ' ' + r.d.spec.unit : ''}`,
          `độ lành mạnh ${(r.d.goodness * 100).toFixed(0)}% (lành mạnh khi ~${r.d.spec.good}${r.d.spec.unit ? ' ' + r.d.spec.unit : ''})`,
        ],
      }))
      .sort((a, b) => b.probability - a.probability);

    const anoms = this.buildAnomalies(spec.assetId, detail);
    const top = rootCauses[0];
    const assetAdv = advisories.filter((a) => a.assetId === spec.assetId);

    const what = `${spec.name.vi}: điểm sức khoẻ ${health.score.toFixed(0)}/100 (dải ${BAND_VI[health.band]}); ${anoms.length} tín hiệu dưới ngưỡng lành mạnh.`;
    let why = top ? `Nguyên nhân khả dĩ nhất: ${top.label} (~${(top.probability * 100).toFixed(0)}%).` : 'Nhiều tín hiệu suy giảm nhẹ đồng thời.';
    for (const a of assetAdv) why += ` Cảnh báo dự đoán: ${a.message}.`;

    const recs = this.buildRecommendations(spec, health, detail);
    const how = recs.length > 0 ? recs.map((r) => r.action).join('; ') + '.' : `Tăng tần suất theo dõi ${spec.name.vi}.`;

    return { assetId: spec.assetId, what, why, how, rootCauses };
  }

  private buildRul(spec: AssetHealthSpec, input: CognitiveInput, advisories: ReadonlyArray<PredictiveAdvisory>): RemainingUsefulLife {
    // Ưu tiên xu hướng: giờ dự báo tới ngưỡng SỚM NHẤT (min projectionH > 0).
    const trend = advisories
      .filter((a) => a.assetId === spec.assetId && a.projectionH !== null && (a.projectionH as number) > 0)
      .map((a) => a.projectionH as number);
    if (trend.length > 0) {
      return {
        assetId: spec.assetId,
        hours: Math.min(...trend),
        confidence: 'medium',
        basis: 'Xu hướng tín hiệu — dự báo thời điểm vượt ngưỡng (rule trend)',
        simulated: true,
      };
    }
    if (spec.designLifeH !== undefined) {
      const remaining = Math.max(0, spec.designLifeH - input.runningHours(spec.assetId));
      return {
        assetId: spec.assetId,
        hours: remaining,
        confidence: 'low',
        basis: `Giờ chạy vs tuổi thọ thiết kế (${spec.designLifeH} h)`,
        simulated: true,
      };
    }
    return {
      assetId: spec.assetId,
      hours: null,
      confidence: 'low',
      basis: 'Thiếu dữ liệu xu hướng và tuổi thọ thiết kế',
      simulated: true,
    };
  }

  private buildRecommendations(spec: AssetHealthSpec, health: MachineHealth, detail: ReadonlyArray<SignalDetail>): MaintenanceRecommendation[] {
    if (health.band === 'healthy') return [];
    const out: MaintenanceRecommendation[] = [];
    const bandAction =
      health.band === 'critical'
        ? `Dừng máy kiểm tra ${spec.name.vi} ngay khi điều kiện an toàn cho phép`
        : health.band === 'warning'
          ? `Lên kế hoạch bảo dưỡng ${spec.name.vi} trong ca/ngày tới`
          : `Tăng tần suất theo dõi ${spec.name.vi}`;
    out.push({
      assetId: spec.assetId,
      action: bandAction,
      priority: priorityForBand(health.band),
      rationale: `Điểm sức khoẻ ${health.score.toFixed(0)}/100 (dải ${BAND_VI[health.band]}).`,
    });
    // Tín hiệu bất thường tệ nhất → khuyến nghị nhắm mục tiêu.
    const worst = [...detail].filter((d) => d.goodness < d.threshold).sort((a, b) => a.goodness - b.goodness)[0];
    if (worst) {
      out.push({
        assetId: spec.assetId,
        action: `Kiểm tra ${worst.spec.label.vi} (hiện ${worst.value.toFixed(2)}${worst.spec.unit ? ' ' + worst.spec.unit : ''})`,
        priority: priorityForGoodness(worst.goodness),
        rationale: `Độ lành mạnh ${(worst.goodness * 100).toFixed(0)}% — thấp nhất trong các tín hiệu.`,
      });
    }
    return out;
  }
}

/**
 * Seam Groundup (dịch vụ cognitive maintenance NGOÀI) — TƯƠNG LAI. CHƯA cấu hình endpoint/SDK/credential
 * → available:false, decline SẠCH mọi truy vấn (undefined/mảng rỗng). TUYỆT ĐỐI không import/giả SDK,
 * không bịa dữ liệu, không lộ secret. Khi tích hợp thật: thay phần thân bằng adapter gọi API Groundup.
 */
export class GroundupCognitiveMaintenanceProvider implements CognitiveMaintenanceProvider {
  readonly info: CognitiveProviderInfo = {
    id: 'groundup-cognitive',
    name: 'Groundup Cognitive Maintenance',
    mode: 'external-demo',
    available: false,
    notice: {
      vi: 'Adapter Groundup CHƯA cấu hình (endpoint/khoá) — chế độ demo, không kết nối dịch vụ thật; không có dữ liệu.',
      en: 'Groundup adapter NOT configured (endpoint/key) — demo mode, no real connection; no data.',
    },
  };

  assets(): ReadonlyArray<string> {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assess(_assetId: string, _input: CognitiveInput): CognitiveAssessment | undefined {
    return undefined; // seam: gọi API Groundup khi đã cấu hình
  }
  detectAnomalies(): ReadonlyArray<Anomaly> {
    return [];
  }
  diagnose(): Diagnosis | undefined {
    return undefined;
  }
  estimateRul(): RemainingUsefulLife | undefined {
    return undefined;
  }
  recommend(): ReadonlyArray<MaintenanceRecommendation> {
    return [];
  }
  fleetOverview(input: CognitiveInput): FleetCognitiveOverview {
    return { generatedTs: input.formatTs(input.nowMs), assets: [], worst: [], anomalyCount: 0, averageScore: 0 };
  }
}

export type CognitiveProviderKind = 'simulation' | 'groundup';

/** Factory chọn nguồn cognitive maintenance theo chế độ vận hành. */
export function createCognitiveProvider(
  kind: CognitiveProviderKind,
  opts?: { specs?: ReadonlyArray<AssetHealthSpec>; rules?: ReadonlyArray<PredictiveRule> },
): CognitiveMaintenanceProvider {
  if (kind === 'groundup') return new GroundupCognitiveMaintenanceProvider();
  return new SimulationCognitiveMaintenanceProvider({ specs: opts?.specs ?? [], rules: opts?.rules });
}
