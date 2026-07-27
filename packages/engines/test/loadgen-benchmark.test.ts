import { describe, it, expect } from 'vitest';
import { MemoryHistorian } from '../src/historian';
import { TimescaleHistorian } from '../src/timescale-historian';
import { generatePoints, measureWriteThroughput } from '../src/loadgen';

const iso = (ms: number): string => new Date(ms).toISOString();
const START = Date.parse('2026-07-24T03:00:00Z');

// Benchmark mốc ghi ≥ 50.000 điểm/s (CLAUDE.md). Đường ĐỆM đồng bộ (Memory + Timescale.write).
describe('Historian throughput — loadgen ≥ 50k điểm/s', () => {
  it('sinh 100k điểm tất định (1000 tag × 100 mẫu)', () => {
    const pts = generatePoints(1000, 100, START, 100, iso);
    expect(pts.length).toBe(100_000);
    expect(pts[0]?.tagId).toBe('LOADGEN_TAG_0');
  });

  it('MemoryHistorian.write ≥ 50k điểm/s', () => {
    const pts = generatePoints(1000, 100, START, 100, iso);
    const h = new MemoryHistorian({ formatTs: iso });
    const r = measureWriteThroughput((b) => h.write(b), pts);
    // eslint-disable-next-line no-console
    console.log(`[bench] MemoryHistorian ${Math.round(r.pointsPerSec).toLocaleString('en-US')} điểm/s (${r.points} trong ${r.ms.toFixed(1)} ms)`);
    expect(r.pointsPerSec).toBeGreaterThanOrEqual(50_000);
  });

  it('TimescaleHistorian.write (đệm) ≥ 50k điểm/s; flush gom cả lô', async () => {
    const pts = generatePoints(1000, 100, START, 100, iso);
    let inserted = 0;
    const h = new TimescaleHistorian({
      exec: async (_sql, params) => {
        inserted += params.length / 4; // 4 param/điểm
        return { rows: [] };
      },
    });
    const r = measureWriteThroughput((b) => h.write(b), pts);
    // eslint-disable-next-line no-console
    console.log(`[bench] Timescale buffer ${Math.round(r.pointsPerSec).toLocaleString('en-US')} điểm/s`);
    expect(r.pointsPerSec).toBeGreaterThanOrEqual(50_000);
    expect(h.pending).toBe(100_000);
    expect(await h.flush()).toBe(100_000);
    expect(inserted).toBe(100_000);
  });
});
