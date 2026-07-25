import { describe, it, expect } from 'vitest';
import { createSkeleton } from '../src/skeleton';

describe('walking skeleton: sim → PID → tag (drum level 3-element)', () => {
  it('giữ mức ~0 khi tải ổn định', () => {
    const s = createSkeleton();
    for (let i = 0; i < 300; i++) s.step();
    expect(Math.abs(s.level())).toBeLessThan(5);
  });

  it('swell khi tăng tải rồi PID kéo mức về', () => {
    const s = createSkeleton();
    for (let i = 0; i < 300; i++) s.step();

    s.setSteamDemand(1800); // load up 1500 → 1800 t/h
    let maxLevel = -Infinity;
    for (let i = 0; i < 60; i++) {
      s.step();
      maxLevel = Math.max(maxLevel, s.level());
    }
    expect(maxLevel).toBeGreaterThan(50); // swell dâng thoáng qua

    for (let i = 0; i < 600; i++) s.step();
    expect(Math.abs(s.level())).toBeLessThan(20); // kéo về gần SP
    expect(s.fwFlow()).toBeGreaterThan(1750); // feedwater đã bắt kịp tải mới
  });

  it('subscribe theo màn hình nhận delta realtime', () => {
    const s = createSkeleton();
    const received: number[] = [];
    s.tag.onDelta((_sid, deltas) => {
      for (const d of deltas) if (typeof d.value === 'number') received.push(d.value);
    });
    s.tag.subscribeScreen('session-1', 'D3-steam-drum', ['BLR_DRUM_LEVEL_01']);
    for (let i = 0; i < 20; i++) s.step();
    expect(received.length).toBeGreaterThan(0);
  });
});
