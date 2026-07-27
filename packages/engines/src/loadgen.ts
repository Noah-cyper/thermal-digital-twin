// L2 — Loadgen (doc 24 W12). Sinh luồng điểm đo TẤT ĐỊNH (không Math.random) để đo throughput ghi
// historian (mốc ≥ 50.000 điểm/s, CLAUDE.md) và benchmark. Dùng cho cả MemoryHistorian & Timescale.
import type { WritePoint } from './historian';

/**
 * Sinh `tagCount × sampleCount` điểm: mỗi tag một chuỗi hình sin lệch pha, mốc thời gian tăng đều.
 * Tất định theo tham số → benchmark tái lập.
 */
export function generatePoints(
  tagCount: number,
  sampleCount: number,
  startMs: number,
  dtMs: number,
  formatTs: (ms: number) => string,
): WritePoint[] {
  const out: WritePoint[] = [];
  for (let s = 0; s < sampleCount; s++) {
    const ts = formatTs(startMs + s * dtMs);
    for (let t = 0; t < tagCount; t++) {
      const value = 100 + 50 * Math.sin((s + t) * 0.01) + t * 0.001;
      out.push({ tagId: `LOADGEN_TAG_${t}`, value, quality: 'Good', ts });
    }
  }
  return out;
}

/** Đo throughput ghi: gọi write theo lô, trả số điểm/giây. */
export function measureWriteThroughput(
  writeFn: (points: ReadonlyArray<WritePoint>) => void,
  points: ReadonlyArray<WritePoint>,
  batchSize = 2000,
): { points: number; ms: number; pointsPerSec: number } {
  const t0 = performance.now();
  for (let i = 0; i < points.length; i += batchSize) {
    writeFn(points.slice(i, i + batchSize));
  }
  const ms = performance.now() - t0;
  return { points: points.length, ms, pointsPerSec: ms > 0 ? (points.length / ms) * 1000 : Infinity };
}
