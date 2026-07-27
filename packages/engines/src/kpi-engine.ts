// L2 — Report/KPI Engine (doc 05-17 / doc 21). Chạy các IKpiCalculator KHAI BÁO của plugin trên dữ
// liệu Historian (doc 05-04). Generic: engine không biết KPI cụ thể — plugin cung cấp công thức.
import type { IKpiCalculator, IKpiInput, IKpiResult, Aggregate, Iso8601 } from '@idtp/sdk';
import type { MemoryHistorian } from './historian';

/** IKpiInput lấy aggregate một-giá-trị trên [from,to] từ Historian (bucket = cả dải → 1 điểm). */
export function historianKpiInput(hist: MemoryHistorian, from: Iso8601, to: Iso8601): IKpiInput {
  // bucket = cả dải + 1 ms → mọi điểm (kể cả điểm tại 'to') gộp vào ĐÚNG một bucket → 1 giá trị.
  const bucketMs = Math.max(1, Date.parse(to) - Date.parse(from)) + 1;
  return {
    range: { from, to },
    read: async (tagId, agg: Aggregate): Promise<number> => {
      const pts = await hist.query(tagId, from, to, agg, bucketMs);
      return pts[0]?.value ?? 0;
    },
  };
}

export class KpiEngine {
  constructor(private readonly calcs: ReadonlyArray<IKpiCalculator>) {}

  computeAll(input: IKpiInput): Promise<IKpiResult[]> {
    return Promise.all(this.calcs.map((c) => c.compute(input)));
  }

  ids(): ReadonlyArray<string> {
    return this.calcs.map((c) => c.kpiId);
  }
}
