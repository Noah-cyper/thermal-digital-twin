import { describe, it, expect } from 'vitest';
import type { NavNode, AlarmDef, ScreenDef } from '@idtp/sdk';
import { NavigationEngine } from '../src/navigation-engine';

const nodes: NavNode[] = [
  { screenId: 'D1', level: 'D1', hotkey: 1, title: { vi: 'P', en: 'P' } },
  { screenId: 'D3a', level: 'D3', parentId: 'D1', hotkey: 2, title: { vi: 'A', en: 'A' } },
];
const screens: ScreenDef[] = [
  { screenId: 'D1', level: 'D1', elements: [{ id: 't', symbol: 'value', x: 0, y: 0, bindings: [{ property: 'text', tag: 'TAG1' }] }] },
  { screenId: 'D3a', level: 'D3', elements: [{ id: 't', symbol: 'value', x: 0, y: 0, bindings: [{ property: 'text', tag: 'TAG1' }] }] },
];
const alarms: AlarmDef[] = [
  { alarmId: 'AL1', tagId: 'TAG1', condition: 'HH', priority: 'P1', setpoint: 1, deadband: 1, onDelayMs: 1, offDelayMs: 1, consequence: { vi: '', en: '' } },
];

describe('NavigationEngine (doc 05-16, ISA-101)', () => {
  it('home = D1; breadcrumb theo parentId; hotkey', () => {
    const nav = new NavigationEngine(nodes, { alarms, screens });
    expect(nav.home()).toBe('D1');
    expect(nav.breadcrumb('D3a').map((n) => n.screenId)).toEqual(['D1', 'D3a']);
    expect(nav.byHotkey(2)).toBe('D3a');
  });

  it('resolveAlarm → D3 chứa tag (ưu tiên D3); không có → fallback D1', () => {
    const nav = new NavigationEngine(nodes, { alarms, screens });
    expect(nav.resolveAlarm('AL1')).toBe('D3a');
    expect(nav.resolveAlarm('UNKNOWN')).toBe('D1');
  });
});
