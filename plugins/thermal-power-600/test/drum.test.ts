import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { DrumModel } from '../src/sim/drum';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return {
    dtMs: 100,
    getTag: (id) => tags[id] ?? 0,
    now: () => '2026-07-24T10:00:00+07:00',
  };
}

function out(res: ISimStepResult, tagId: string): number {
  return res.outputs.find((o) => o.tagId === tagId)?.value ?? NaN;
}

describe('DrumModel', () => {
  it('cân bằng khối lượng: fw > steam → mức dâng dần theo thời gian', () => {
    const drum = new DrumModel();
    drum.init();
    // fw ≈ 1596 t/h > steam 1500 → net inflow dương; swell là offset không đổi,
    // nên thành phần khối lượng làm mức dâng dần (kiểm xu hướng, không phải giá trị tuyệt đối).
    const ctx = mkCtx({ BLR_FW_CV_01: 76, BLR_STEAM_DEMAND: 1500 });
    let l100 = 0;
    let l300 = 0;
    for (let i = 0; i < 300; i++) {
      const level = out(drum.step(ctx), 'BLR_DRUM_LEVEL_01');
      if (i === 99) l100 = level;
      if (i === 299) l300 = level;
    }
    expect(l300).toBeGreaterThan(l100);
  });

  it('swell: steam tăng đột ngột → mức dâng thoáng qua (đảo pha)', () => {
    const drum = new DrumModel();
    drum.init();
    const balancedCv = (1500 / 2100) * 100;
    const ctxBal = mkCtx({ BLR_FW_CV_01: balancedCv, BLR_STEAM_DEMAND: 1500 });
    drum.step(ctxBal);
    const balanced = out(drum.step(ctxBal), 'BLR_DRUM_LEVEL_01');
    const ctxUp = mkCtx({ BLR_FW_CV_01: balancedCv, BLR_STEAM_DEMAND: 1800 });
    const swelled = out(drum.step(ctxUp), 'BLR_DRUM_LEVEL_01');
    expect(swelled).toBeGreaterThan(balanced + 50);
  });

  it('tube-leak giảm feedwater; clear khôi phục', () => {
    const drum = new DrumModel();
    drum.init();
    const ctx = mkCtx({ BLR_FW_CV_01: 50, BLR_STEAM_DEMAND: 0 });
    const before = out(drum.step(ctx), 'BLR_FW_FLOW_01');
    drum.injectMalfunction({ id: 'tube-leak', params: { rate: 100 } });
    const during = out(drum.step(ctx), 'BLR_FW_FLOW_01');
    drum.clearMalfunction('tube-leak');
    const after = out(drum.step(ctx), 'BLR_FW_FLOW_01');
    expect(during).toBeLessThan(before);
    expect(after).toBeCloseTo(before, 5);
  });

  it('snapshot/restore tái lập trạng thái', () => {
    const drum = new DrumModel();
    drum.init();
    const ctx = mkCtx({ BLR_FW_CV_01: 100, BLR_STEAM_DEMAND: 0 });
    for (let i = 0; i < 50; i++) drum.step(ctx);
    const snap = drum.snapshot();
    const levelAtSnap = out(drum.step(ctx), 'BLR_DRUM_LEVEL_01');
    for (let i = 0; i < 20; i++) drum.step(ctx);
    drum.restore(snap);
    const restored = out(drum.step(ctx), 'BLR_DRUM_LEVEL_01');
    expect(restored).toBeCloseTo(levelAtSnap, 5);
  });
});
