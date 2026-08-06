// Plugin water-treatment-demo — 3 màn hình KHAI BÁO (D1 + 2×D3). Chỉ import type từ @idtp/sdk.
// Cùng Graphics Runtime generic render — không sửa engine. Palette ISA-101 (doc 11).
import type { ScreenDef, ScreenElement, Binding } from '@idtp/sdk';

const COL = 168;
const ROW = 100;

function at(col: number, row: number): { x: number; y: number } {
  return { x: 24 + col * COL, y: 24 + row * ROW };
}

interface AlarmCond {
  when: 'gt' | 'lt';
  value: number;
  sev: 1 | 2 | 3;
}

function valueTile(id: string, tag: string, label: string, unit: string, col: number, row: number, alarms: AlarmCond[] = []): ScreenElement {
  const bindings: Binding[] = [{ property: 'text', tag, transform: { kind: 'linear', scale: 1 } }];
  for (const a of alarms) bindings.push({ property: 'fill', tag, condition: { when: a.when, value: a.value, then: { fill: `var(--alarm-${a.sev})` } } });
  bindings.push({ property: 'fill', tag, condition: { when: 'bad', then: { fill: 'var(--bad-quality)' } } });
  return { id, symbol: 'value', ...at(col, row), w: 150, h: 78, label, unit, bindings };
}

function barTile(id: string, tag: string, label: string, col: number, row: number, scale: number): ScreenElement {
  return { id, symbol: 'bar', ...at(col, row), w: 150, h: 78, label, unit: '%', bindings: [{ property: 'value', tag, transform: { kind: 'linear', scale } }] };
}

export const waterScreens: ReadonlyArray<ScreenDef> = [
  {
    screenId: 'D1-wtp-overview',
    level: 'D1',
    title: { vi: 'Tổng quan xử lý nước DM', en: 'DM Water Overview' },
    elements: [
      valueTile('level', 'WTP_TANK_LEVEL_01', 'Mức bể DM', '%', 0, 0, [
        { when: 'gt', value: 90, sev: 1 },
        { when: 'lt', value: 10, sev: 1 },
      ]),
      valueTile('feed', 'WTP_FEED_FLOW_01', 'Lưu lượng cấp', 'm³/h', 1, 0),
      valueTile('out', 'WTP_OUT_FLOW_01', 'Lưu lượng ra', 'm³/h', 2, 0),
      valueTile('pumpa', 'WTP_PUMP_A_RUN', 'Bơm cấp A', '', 3, 0, [{ when: 'lt', value: 0.5, sev: 1 }]),
    ],
  },
  {
    screenId: 'D3-wtp-tank',
    level: 'D3',
    title: { vi: 'Bể DM & điều khiển mức', en: 'DM Tank & Level Control' },
    elements: [
      valueTile('level', 'WTP_TANK_LEVEL_01', 'Mức bể DM (SP 60%)', '%', 0, 0, [
        { when: 'gt', value: 90, sev: 1 },
        { when: 'gt', value: 80, sev: 2 },
        { when: 'lt', value: 25, sev: 2 },
        { when: 'lt', value: 10, sev: 1 },
      ]),
      valueTile('feed', 'WTP_FEED_FLOW_01', 'Lưu lượng cấp', 'm³/h', 1, 0),
      valueTile('out', 'WTP_OUT_FLOW_01', 'Lưu lượng ra', 'm³/h', 2, 0),
      barTile('cv', 'WTP_FEED_CV_01', 'Van cấp (OP)', 0, 1, 1),
    ],
  },
  {
    screenId: 'D3-wtp-pumps',
    level: 'D3',
    title: { vi: 'Bơm cấp & nhu cầu', en: 'Feed Pumps & Demand' },
    elements: [
      valueTile('pumpa', 'WTP_PUMP_A_RUN', 'Bơm cấp A', '', 0, 0, [{ when: 'lt', value: 0.5, sev: 1 }]),
      valueTile('feed', 'WTP_FEED_FLOW_01', 'Lưu lượng cấp', 'm³/h', 1, 0),
      valueTile('demand', 'WTP_DEMAND_01', 'Nhu cầu ra', 'm³/h', 2, 0, [{ when: 'gt', value: 180, sev: 3 }]),
    ],
  },
  {
    screenId: 'D3-wtp-ro',
    level: 'D3',
    title: { vi: 'Màng RO — thẩm thấu ngược', en: 'RO Membrane Train' },
    elements: [
      valueTile('perm', 'WTP_RO_PERMEATE_FLOW_01', 'Permeate (sạch)', 'm³/h', 0, 0),
      valueTile('reject', 'WTP_RO_REJECT_FLOW_01', 'Reject (đậm muối)', 'm³/h', 1, 0),
      valueTile('rec', 'WTP_RO_RECOVERY_01', 'Thu hồi', '%', 2, 0, [{ when: 'lt', value: 65, sev: 2 }]),
      valueTile('dp', 'WTP_RO_DP_01', 'ΔP màng', 'bar', 0, 1, [{ when: 'gt', value: 3.5, sev: 2 }]),
      valueTile('salt', 'WTP_RO_SALT_REJECT_01', 'Khử muối', '%', 1, 1, [{ when: 'lt', value: 98, sev: 2 }]),
      valueTile('cond', 'WTP_RO_PERM_COND_01', 'Độ dẫn permeate', 'µS/cm', 2, 1, [{ when: 'gt', value: 15, sev: 2 }]),
      valueTile('rohealth', 'WTP_RO_HEALTHY_01', 'Màng bình thường', '', 0, 2, [{ when: 'lt', value: 0.5, sev: 2 }]),
    ],
  },
];

export function waterScreenTags(screen: ScreenDef): string[] {
  const set = new Set<string>();
  for (const el of screen.elements) for (const b of el.bindings) set.add(b.tag);
  return [...set];
}
