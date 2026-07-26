import { describe, it, expect } from 'vitest';
import type { ControlLoopDef } from '@idtp/sdk';
import { ControlLoopEngine } from '../src/control-loop-engine';

/** Đóng vòng với plant gain 1 (pv theo op) — kiểm loop hội tụ. */
function closeLoop(engine: ControlLoopEngine, tags: Record<string, number>, steps: number): void {
  const ctx = { getTag: (id: string) => tags[id] ?? 0 };
  for (let i = 0; i < steps; i++) {
    for (const o of engine.step(ctx, 0.1)) tags[o.outTag] = o.value;
    tags.pv = tags.op;
  }
}

describe('ControlLoopEngine', () => {
  it('loop AUTO kéo PV về SP cố định (plant gain 1)', () => {
    const tags: Record<string, number> = { pv: 0, op: 0 };
    const engine = new ControlLoopEngine([
      { id: 'L1', pvTag: 'pv', sp: 10, kp: 0.5, ki: 0.5, kd: 0, outLo: 0, outHi: 100, outTag: 'op' },
    ]);
    closeLoop(engine, tags, 400);
    expect(Math.abs((tags.pv ?? 0) - 10)).toBeLessThan(1);
  });

  it('cascade: SP lấy từ spTag × spScale', () => {
    const tags: Record<string, number> = { pv: 0, op: 0, master: 40 };
    const engine = new ControlLoopEngine([
      { id: 'inner', pvTag: 'pv', spTag: 'master', spScale: 2, kp: 0.5, ki: 0.5, kd: 0, outLo: 0, outHi: 200, outTag: 'op' },
    ]);
    closeLoop(engine, tags, 400);
    expect(Math.abs((tags.pv ?? 0) - 80)).toBeLessThan(2); // SP = 40 × 2
  });

  it('feedforward: OP nhảy ngay theo ffTag × ffGain khi err = 0', () => {
    const tags: Record<string, number> = { pv: 0, ff: 30 };
    const engine = new ControlLoopEngine([
      { id: 'ffl', pvTag: 'pv', sp: 0, kp: 0.01, ki: 0, kd: 0, outLo: 0, outHi: 100, ffTag: 'ff', ffGain: 1, outTag: 'op' },
    ]);
    const outs = engine.step({ getTag: (id) => tags[id] ?? 0 }, 0.1);
    expect(outs[0]?.value).toBeCloseTo(30, 5);
  });

  it('setMode MAN giữ manual output; getMode/loopIds hoạt động', () => {
    const engine = new ControlLoopEngine([
      { id: 'L1', pvTag: 'pv', sp: 10, kp: 1, ki: 1, kd: 0, outLo: 0, outHi: 100, outTag: 'op' },
    ]);
    engine.setMode('L1', 'MAN');
    engine.setManualOutput('L1', 55);
    const outs = engine.step({ getTag: () => 0 }, 0.1);
    expect(outs[0]?.value).toBe(55);
    expect(engine.getMode('L1')).toBe('MAN');
    expect(engine.loopIds()).toEqual(['L1']);
  });
});
