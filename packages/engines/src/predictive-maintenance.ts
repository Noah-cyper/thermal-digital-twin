// L2 — Predictive Maintenance v1 RULE-BASED (doc 05-18 / doc 20). READ-ONLY: đọc tag + giờ chạy →
// cảnh báo SỚM. Ba loại luật: ngưỡng (value ≥ warn/limit), xu hướng (rate → dự báo thời điểm vượt
// limit), giờ chạy (tới hạn PM). Có TRẠNG THÁI nhẹ (mẫu tag trước) để tính rate. ML thật = v3.
import type { PredictiveAdvisory, PredictiveRule, PredictiveSeverity } from '@idtp/sdk';

export interface PredictiveContext {
  nowMs: number;
  getTag(tag: string): number;
  runningHours(assetId: string): number;
}

export class PredictiveMaintenance {
  private readonly hist = new Map<string, { t: number; v: number }>();
  constructor(private readonly rules: ReadonlyArray<PredictiveRule>) {}

  evaluate(ctx: PredictiveContext): PredictiveAdvisory[] {
    const out: PredictiveAdvisory[] = [];
    const push = (r: PredictiveRule, severity: PredictiveSeverity, message: string, metric: number, projectionH: number | null): void => {
      out.push({ ruleId: r.ruleId, assetId: r.assetId, severity, message, metric, projectionH });
    };

    for (const r of this.rules) {
      if (r.kind === 'threshold' && r.tag) {
        const v = ctx.getTag(r.tag);
        if (r.limit !== undefined && v >= r.limit) push(r, 'alert', `${r.title.vi}: ${v.toFixed(2)} ≥ ngưỡng nguy hiểm ${r.limit}`, v, null);
        else if (r.warn !== undefined && v >= r.warn) push(r, 'warn', `${r.title.vi}: ${v.toFixed(2)} ≥ ngưỡng cảnh báo ${r.warn}`, v, null);
      } else if (r.kind === 'trend' && r.tag && r.limit !== undefined) {
        const v = ctx.getTag(r.tag);
        const prev = this.hist.get(r.tag);
        this.hist.set(r.tag, { t: ctx.nowMs, v });
        if (prev && ctx.nowMs > prev.t) {
          const rate = (v - prev.v) / ((ctx.nowMs - prev.t) / 3_600_000); // đơn vị / giờ
          if (rate > 1e-9 && v < r.limit) {
            const projH = (r.limit - v) / rate;
            const horizon = r.horizonH ?? Infinity;
            if (projH <= horizon) {
              const sev: PredictiveSeverity = projH <= horizon / 3 ? 'alert' : 'warn';
              push(r, sev, `${r.title.vi}: xu hướng tăng, dự báo vượt ${r.limit} sau ~${projH.toFixed(1)} h`, v, projH);
            }
          }
        }
      } else if (r.kind === 'runhours' && r.pmHours !== undefined) {
        const h = ctx.runningHours(r.assetId);
        const remaining = r.pmHours - h;
        if (remaining <= (r.horizonH ?? Infinity)) {
          if (remaining <= 0) push(r, 'alert', `${r.title.vi}: QUÁ HẠN bảo dưỡng ${(-remaining).toFixed(0)} h`, h, remaining);
          else push(r, 'warn', `${r.title.vi}: còn ~${remaining.toFixed(0)} h tới bảo dưỡng`, h, remaining);
        }
      }
    }
    return out;
  }

  reset(): void {
    this.hist.clear();
  }
}
