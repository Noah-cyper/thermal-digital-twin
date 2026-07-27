import { describe, it, expect } from 'vitest';
import { applyScreen, type TagRead } from '@idtp/engines';
import type { ScreenDef } from '@idtp/sdk';
import { boilerScreens, screenTags } from '@idtp/plugin-thermal-power-600';

function d1(): ScreenDef {
  const s = boilerScreens.find((x) => x.screenId === 'D1-plant-overview');
  if (!s) throw new Error('D1 missing');
  return s;
}

describe('boiler screens (khai báo) + graphics binding', () => {
  it('có D1 Plant Overview + ít nhất 1 D3; mọi element có tag & binding', () => {
    const ids = boilerScreens.map((s) => s.screenId);
    expect(ids).toContain('D1-plant-overview');
    expect(boilerScreens.some((s) => s.level === 'D3')).toBe(true);
    for (const s of boilerScreens) {
      expect(screenTags(s).length).toBeGreaterThan(0);
      for (const el of s.elements) expect(el.bindings.length).toBeGreaterThan(0);
    }
  });

  it('binding: mức bao hơi > 250 mm → fill alarm-1; trong dải → không tô', () => {
    const alarm = applyScreen(d1(), new Map<string, TagRead>([['BLR_DRUM_LEVEL_01', { value: 300, quality: 'Good' }]]));
    expect(alarm.get('drum')?.fill).toBe('var(--alarm-1)');
    const ok = applyScreen(d1(), new Map<string, TagRead>([['BLR_DRUM_LEVEL_01', { value: 0, quality: 'Good' }]]));
    expect(ok.get('drum')?.fill).toBeUndefined();
  });

  it('binding: bad quality → fill bad-quality; text = PV', () => {
    const bad = applyScreen(d1(), new Map<string, TagRead>([['GEN_MW_01', { value: 448, quality: 'Bad' }]]));
    expect(bad.get('mw')?.fill).toBe('var(--bad-quality)');
    expect(bad.get('mw')?.text).toBe('448');
  });
});
