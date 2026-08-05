import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import type { ScenarioPhaseResult } from '@idtp/sdk';

describe('thermal-runtime — kịch bản cold-start → hoà lưới → ramp đầy tải 600 MW', () => {
  it('chạy hết 10 pha: mọi SFC khởi động done; ramp đưa MW lên đầy tải, chân không lập', () => {
    const rt = createThermalRuntime(); // warm-start ở điểm vận hành (cold-start mang tính điều phối)
    const res = rt.runScenario('cold-start-to-full-load');
    const by: Record<string, ScenarioPhaseResult> = {};
    for (const r of res) by[r.phaseId] = r;

    expect(res.length).toBe(10);
    // 8 pha SFC khởi động (gồm 2 tiền đề mới) phải 'ok'.
    for (const id of ['vacuum', 'purge', 'light-off', 'fw-fill', 'pressure-raise', 'mill-start', 'turbine-roll', 'sync']) {
      expect(by[id]?.status).toBe('ok');
    }

    const mw = (id: string): number => by[id]?.tags['GEN_MW_01'] ?? 0;
    // Chân không bình ngưng lập (áp tuyệt đối thấp) suốt kịch bản.
    expect(by['vacuum']?.tags['TRB_COND_VACUUM_01'] ?? 99).toBeLessThan(10);
    // Ramp đầy tải đưa MW LÊN cao hơn mốc đầu + tiến tới đầy tải (không phân kỳ số).
    expect(mw('ramp-full')).toBeGreaterThan(mw('vacuum'));
    expect(mw('coordinated')).toBeGreaterThan(480);
    expect(Number.isFinite(mw('coordinated'))).toBe(true);
    // Áp hơi chính giữ định mức khi đầy tải phối hợp.
    expect(by['coordinated']?.tags['BLR_MSTM_SH_PRESS_01'] ?? 0).toBeGreaterThan(15);
  });
});
