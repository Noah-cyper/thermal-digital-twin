import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import type { ScenarioPhaseResult } from '@idtp/sdk';

describe('thermal-runtime — kịch bản §10 (cold-start → ramp → mill trip → runback → MFT → coast-down)', () => {
  it('chạy hết 14 pha: SFC khởi động + thông gió sau trip done; MFT tay cắt nhiên liệu THẬT → coast-down', () => {
    const rt = createThermalRuntime(); // warm-start ở điểm vận hành
    expect(rt.scenarioList().length).toBe(1);

    const res = rt.runScenario('unit-startup-to-coastdown');
    const by: Record<string, ScenarioPhaseResult> = {};
    for (const r of res) by[r.phaseId] = r;

    // 14 pha; 6 SFC khởi động + thông gió-sau-trip phải 'ok'. post-trip-purge có permissive MFT ≥ 1 →
    // chỉ 'ok' NẾU MFT đã thực sự chốt trip (chứng minh cả chuỗi MFT hoạt động end-to-end).
    expect(res.length).toBe(14);
    for (const id of ['purge', 'light-off', 'fw-fill', 'mill-start', 'turbine-roll', 'sync', 'post-trip-purge']) {
      expect(by[id]?.status).toBe('ok');
    }

    const mw = (id: string): number => by[id]?.tags['GEN_MW_01'] ?? 0;
    const coal = (id: string): number => by[id]?.tags['BLR_COAL_FLOW_01'] ?? 0;

    // ramp 550 → MW cao hơn lúc purge (khởi động).
    expect(mw('ramp-up')).toBeGreaterThan(mw('purge'));
    // MASTER FUEL TRIP (nút tay → Cause&Effect) đã CHỐT → cắt nhiên liệu THẬT (không chỉ đặt tải 0).
    expect(by['coast-down']?.tags['BLR_MFT_TRIP'] ?? 0).toBeGreaterThan(0);
    expect(coal('coast-down')).toBeLessThan(30);
    // Coast-down: công suất tụt sâu khỏi đỉnh ramp.
    expect(mw('coast-down')).toBeLessThan(mw('ramp-up') * 0.5);
    // Sự cố mill: steam vẫn hữu hạn (không phân kỳ số).
    expect(Number.isFinite(by['mill-trip']?.tags['BLR_STEAM_FLOW_01'] ?? NaN)).toBe(true);
  });
});
