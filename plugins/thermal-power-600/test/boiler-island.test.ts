import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { BoilerIslandModel } from '../src/sim/boiler-island';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-07-24T10:00:00+07:00' };
}
function out(res: ISimStepResult, tagId: string): number {
  return res.outputs.find((o) => o.tagId === tagId)?.value ?? NaN;
}
/** Chạy n bước với đầu vào cố định, trả kết quả bước cuối. */
function run(m: BoilerIslandModel, ctx: ISimModelContext, n: number): ISimStepResult {
  let r: ISimStepResult = m.step(ctx);
  for (let i = 1; i < n; i++) r = m.step(ctx);
  return r;
}

describe('BoilerIslandModel', () => {
  it('cân bằng khối lượng: fw > steam → mức dâng; fw < steam → mức hạ', () => {
    const up = new BoilerIslandModel();
    up.init();
    const cUp = mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 85, BLR_TURBINE_DEMAND_01: 1490 });
    let l1 = 0;
    let l2 = 0;
    for (let i = 0; i < 2000; i++) {
      const r = up.step(cUp);
      if (i === 1499) l1 = out(r, 'BLR_DRUM_LEVEL_01');
      if (i === 1999) l2 = out(r, 'BLR_DRUM_LEVEL_01');
    }
    expect(l2).toBeGreaterThan(l1);

    const dn = new BoilerIslandModel();
    dn.init();
    const cDn = mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 55, BLR_TURBINE_DEMAND_01: 1490 });
    let d1 = 0;
    let d2 = 0;
    for (let i = 0; i < 2000; i++) {
      const r = dn.step(cDn);
      if (i === 1499) d1 = out(r, 'BLR_DRUM_LEVEL_01');
      if (i === 1999) d2 = out(r, 'BLR_DRUM_LEVEL_01');
    }
    expect(d2).toBeLessThan(d1);
  });

  it('cháy: nhiên liệu cao hơn → hơi sinh nhiều hơn', () => {
    const lo = new BoilerIslandModel();
    lo.init();
    const hi = new BoilerIslandModel();
    hi.init();
    const sLo = out(run(lo, mkCtx({ BLR_FUEL_DEMAND_01: 60, BLR_FD_DAMPER_01: 80 }), 1500), 'BLR_STEAM_FLOW_01');
    const sHi = out(run(hi, mkCtx({ BLR_FUEL_DEMAND_01: 90, BLR_FD_DAMPER_01: 80 }), 1500), 'BLR_STEAM_FLOW_01');
    expect(sHi).toBeGreaterThan(sLo + 100);
  });

  it('áp hơi chính: gen > draw → áp tăng; draw > gen → áp giảm', () => {
    const m = new BoilerIslandModel();
    m.init();
    const build = mkCtx({ BLR_FUEL_DEMAND_01: 80, BLR_FD_DAMPER_01: 70, BLR_TURBINE_DEMAND_01: 500 });
    const p1 = out(run(m, build, 300), 'BLR_MSTM_SH_PRESS_01');
    const p2 = out(run(m, build, 300), 'BLR_MSTM_SH_PRESS_01');
    expect(p2).toBeGreaterThan(p1);

    const draw = mkCtx({ BLR_FUEL_DEMAND_01: 80, BLR_FD_DAMPER_01: 70, BLR_TURBINE_DEMAND_01: 2600 });
    const p3 = out(run(m, draw, 300), 'BLR_MSTM_SH_PRESS_01');
    const p4 = out(run(m, draw, 300), 'BLR_MSTM_SH_PRESS_01');
    expect(p4).toBeLessThan(p3);
  });

  it('O₂: nhiều gió hơn (cùng nhiên liệu) → O₂ cao hơn', () => {
    const lean = new BoilerIslandModel();
    lean.init();
    const rich = new BoilerIslandModel();
    rich.init();
    const o2Lean = out(run(lean, mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 80 }), 800), 'BLR_FLUE_O2_01');
    const o2Rich = out(run(rich, mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 50 }), 800), 'BLR_FLUE_O2_01');
    expect(o2Lean).toBeGreaterThan(o2Rich);
  });

  it('nhiệt độ hơi SH: spray nhiều hơn → nhiệt độ thấp hơn', () => {
    const hot = new BoilerIslandModel();
    hot.init();
    const cool = new BoilerIslandModel();
    cool.init();
    const tHot = out(run(hot, mkCtx({ BLR_FUEL_DEMAND_01: 75, BLR_FD_DAMPER_01: 62, BLR_SH_SPRAY_CV_01: 5 }), 1500), 'BLR_MSTM_SH_TEMP_01');
    const tCool = out(run(cool, mkCtx({ BLR_FUEL_DEMAND_01: 75, BLR_FD_DAMPER_01: 62, BLR_SH_SPRAY_CV_01: 60 }), 1500), 'BLR_MSTM_SH_TEMP_01');
    expect(tHot).toBeGreaterThan(tCool + 20);
  });

  it('swell: tăng tải đột ngột → mức dâng thoáng qua (đảo pha)', () => {
    const m = new BoilerIslandModel();
    m.init();
    const base = mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 71, BLR_TURBINE_DEMAND_01: 1490 });
    let l0 = 0;
    for (let i = 0; i < 1500; i++) l0 = out(m.step(base), 'BLR_DRUM_LEVEL_01');

    const loadUp = mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_FW_CV_01: 71, BLR_TURBINE_DEMAND_01: 1900 });
    let maxL = -Infinity;
    for (let i = 0; i < 50; i++) maxL = Math.max(maxL, out(m.step(loadUp), 'BLR_DRUM_LEVEL_01'));
    expect(maxL).toBeGreaterThan(l0 + 15);
  });

  it('tất định: hai model cùng đầu vào → đầu ra trùng khít (nhiễu có seed)', () => {
    const a = new BoilerIslandModel();
    a.init();
    const b = new BoilerIslandModel();
    b.init();
    const ctx = mkCtx({ BLR_FUEL_DEMAND_01: 65, BLR_FD_DAMPER_01: 60, BLR_TURBINE_DEMAND_01: 1200 });
    for (let i = 0; i < 500; i++) {
      expect(out(a.step(ctx), 'BLR_MSTM_SH_PRESS_01')).toBe(out(b.step(ctx), 'BLR_MSTM_SH_PRESS_01'));
    }
  });

  it('snapshot/restore tái lập trạng thái (kể cả seed nhiễu)', () => {
    const m = new BoilerIslandModel();
    m.init();
    const ctx = mkCtx({ BLR_FUEL_DEMAND_01: 72, BLR_FD_DAMPER_01: 63, BLR_FW_CV_01: 68, BLR_TURBINE_DEMAND_01: 1400 });
    for (let i = 0; i < 400; i++) m.step(ctx);
    const snap = m.snapshot();
    const after = out(m.step(ctx), 'BLR_MSTM_SH_PRESS_01');
    for (let i = 0; i < 100; i++) m.step(ctx);
    m.restore(snap);
    expect(out(m.step(ctx), 'BLR_MSTM_SH_PRESS_01')).toBe(after);
  });

  it('malfunction: tube-leak giảm feedwater; mill-trip giảm công suất hơi; clear khôi phục', () => {
    const m = new BoilerIslandModel();
    m.init();
    const ctx = mkCtx({ BLR_FUEL_DEMAND_01: 100, BLR_FD_DAMPER_01: 80, BLR_FW_CV_01: 60, BLR_TURBINE_DEMAND_01: 1500 });
    const fwBefore = out(run(m, ctx, 5), 'BLR_FW_FLOW_01');
    m.injectMalfunction({ id: 'tube-leak', params: { rate: 120 } });
    expect(out(m.step(ctx), 'BLR_FW_FLOW_01')).toBeLessThan(fwBefore - 100);
    m.clearMalfunction('tube-leak');
    expect(out(m.step(ctx), 'BLR_FW_FLOW_01')).toBeGreaterThan(fwBefore - 10); // phục hồi ~mức cũ

    const full = new BoilerIslandModel();
    full.init();
    const steamFull = out(run(full, ctx, 1500), 'BLR_STEAM_FLOW_01');
    full.injectMalfunction({ id: 'mill-trip' });
    const steamTrip = out(run(full, ctx, 1500), 'BLR_STEAM_FLOW_01');
    expect(steamTrip).toBeLessThan(steamFull);
  });

  it('malfunction: trip quạt FD → O₂ sập; trip quạt ID → áp buồng lửa dương; clear khôi phục', () => {
    const ctx = mkCtx({ BLR_FUEL_DEMAND_01: 70, BLR_FD_DAMPER_01: 62, BLR_ID_VANE_01: 62 });
    const base = new BoilerIslandModel();
    base.init();
    const o2Base = out(run(base, ctx, 800), 'BLR_FLUE_O2_01');
    const furnBase = out(run(base, ctx, 200), 'BLR_FURN_PRESS_01');
    expect(furnBase).toBeLessThan(0); // bình thường buồng lửa âm (~ −50 Pa)

    const fd = new BoilerIslandModel();
    fd.init();
    fd.injectMalfunction({ id: 'fd-fan-trip' });
    const o2Fd = out(run(fd, ctx, 800), 'BLR_FLUE_O2_01');
    expect(o2Fd).toBeLessThan(o2Base - 1); // thiếu gió cháy → O₂ sập rõ
    fd.clearMalfunction('fd-fan-trip');
    expect(out(run(fd, ctx, 800), 'BLR_FLUE_O2_01')).toBeGreaterThan(o2Fd + 0.5); // khôi phục

    const idm = new BoilerIslandModel();
    idm.init();
    idm.injectMalfunction({ id: 'id-fan-trip' });
    expect(out(run(idm, ctx, 300), 'BLR_FURN_PRESS_01')).toBeGreaterThan(0); // mất hút → dương
  });
});
