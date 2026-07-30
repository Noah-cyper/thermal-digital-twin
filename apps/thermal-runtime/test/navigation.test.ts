import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, boilerAlarms, screenTags } from '@idtp/plugin-thermal-power-600';

describe('thermal-runtime — Navigation (cây + alarm→D3 + breadcrumb)', () => {
  it('home D1, cây ≥ 3 node, breadcrumb, alarm→D3 chứa tag', () => {
    const rt = createThermalRuntime();
    expect(rt.navHome()).toBe('D1-plant-mimic'); // v2: sơ đồ mimic là màn chủ D1 (đầu danh sách D1)
    expect(rt.navTree().length).toBeGreaterThanOrEqual(3);
    expect(rt.navBreadcrumb('D3-steam-drum').map((n) => n.screenId)).toEqual(['D1-plant-overview', 'D3-steam-drum']);

    const idx = rt.navAlarmIndex();
    // Bất biến §7.2 (bền với việc sắp xếp lại/gộp màn thành sơ đồ bố trí): mỗi alarm nhảy tới MỘT màn
    // hình D3 mà màn đó THỰC SỰ hiển thị tag của alarm — không chốt cứng screenId cụ thể.
    const screenById = new Map(boilerScreens.map((s) => [s.screenId, s] as const));
    const jumpsToD3ShowingTag = (alarmId: string): boolean => {
      const alarm = boilerAlarms.find((a) => a.alarmId === alarmId);
      const scr = screenById.get(idx[alarmId] ?? '');
      return alarm !== undefined && scr !== undefined && scr.level === 'D3' && screenTags(scr).includes(alarm.tagId);
    };
    expect(jumpsToD3ShowingTag('BLR-DRUM-LVL-HH')).toBe(true);
    expect(jumpsToD3ShowingTag('BLR-FLUE-O2-LO')).toBe(true);
  });
});
