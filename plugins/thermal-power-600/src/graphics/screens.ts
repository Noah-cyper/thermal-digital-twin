// Plugin thermal-power-600 — màn hình KHAI BÁO (doc 12/13). Dữ liệu thuần: CHỈ import type từ
// @idtp/sdk. Graphics Runtime render qua binding; client vẽ theo symbol (value·bar). Palette doc 11
// (ISA-101): giá trị bình thường trung tính, chỉ đổi màu khi bất thường (alarm-1/2/3).
import type { ScreenDef, ScreenElement, Binding } from '@idtp/sdk';

const COL = 168;
const ROW = 100;
const X0 = 24;
const Y0 = 24;
const TILE_W = 150;
const TILE_H = 78;

function at(col: number, row: number): { x: number; y: number } {
  return { x: X0 + col * COL, y: Y0 + row * ROW };
}

interface AlarmCond {
  when: 'gt' | 'lt';
  value: number;
  sev: 1 | 2 | 3;
}

/** Ô hiển thị số (label + PV + EU); đổi màu khi vượt ngưỡng hoặc bad quality. */
function valueTile(
  id: string,
  tag: string,
  label: string,
  unit: string,
  col: number,
  row: number,
  alarms: AlarmCond[] = [],
): ScreenElement {
  const bindings: Binding[] = [{ property: 'text', tag, transform: { kind: 'linear', scale: 1 } }];
  for (const a of alarms) {
    bindings.push({ property: 'fill', tag, condition: { when: a.when, value: a.value, then: { fill: `var(--alarm-${a.sev})` } } });
  }
  bindings.push({ property: 'fill', tag, condition: { when: 'bad', then: { fill: 'var(--bad-quality)' } } });
  return { id, symbol: 'value', ...at(col, row), w: TILE_W, h: TILE_H, label, unit, bindings };
}

/** Thanh bar 0–100% (vd OP van, damper). scale đưa PV về thang 0–100. */
function barTile(id: string, tag: string, label: string, col: number, row: number, scale: number): ScreenElement {
  return {
    id,
    symbol: 'bar',
    ...at(col, row),
    w: TILE_W,
    h: TILE_H,
    label,
    unit: '%',
    bindings: [{ property: 'value', tag, transform: { kind: 'linear', scale } }],
  };
}

export const boilerScreens: ReadonlyArray<ScreenDef> = [
  {
    screenId: 'D1-plant-overview',
    level: 'D1',
    title: { vi: 'Tổng quan nhà máy', en: 'Plant Overview' },
    elements: [
      valueTile('mw', 'GEN_MW_01', 'Công suất', 'MW', 0, 0),
      valueTile('steam', 'BLR_STEAM_FLOW_01', 'Hơi chính', 't/h', 1, 0),
      valueTile('press', 'BLR_MSTM_SH_PRESS_01', 'Áp hơi chính', 'MPa', 2, 0, [
        { when: 'gt', value: 19, sev: 2 },
        { when: 'lt', value: 16, sev: 2 },
      ]),
      valueTile('temp', 'BLR_MSTM_SH_TEMP_01', 'Nhiệt hơi SH', '°C', 3, 0, [{ when: 'gt', value: 550, sev: 2 }]),
      valueTile('drum', 'BLR_DRUM_LEVEL_01', 'Mức bao hơi', 'mm', 0, 1, [
        { when: 'gt', value: 250, sev: 1 },
        { when: 'lt', value: -250, sev: 1 },
      ]),
      valueTile('o2', 'BLR_FLUE_O2_01', 'O₂ khói', '%', 1, 1, [{ when: 'lt', value: 1.5, sev: 2 }]),
      valueTile('coal', 'BLR_COAL_FLOW_01', 'Lưu lượng than', 't/h', 2, 1),
      valueTile('furnace', 'BLR_FURN_PRESS_01', 'Áp buồng lửa', 'Pa', 3, 1, [
        { when: 'gt', value: 200, sev: 1 },
        { when: 'lt', value: -200, sev: 1 },
      ]),
    ],
  },
  {
    screenId: 'D3-steam-drum',
    level: 'D3',
    title: { vi: 'Bao hơi & cấp nước', en: 'Steam Drum & Feedwater' },
    elements: [
      valueTile('level', 'BLR_DRUM_LEVEL_01', 'Mức bao hơi', 'mm', 0, 0, [
        { when: 'gt', value: 250, sev: 1 },
        { when: 'lt', value: -250, sev: 1 },
      ]),
      valueTile('steam', 'BLR_STEAM_FLOW_01', 'Hơi sinh ra', 't/h', 1, 0),
      valueTile('fw', 'BLR_FW_FLOW_01', 'Nước cấp', 't/h', 2, 0),
      valueTile('press', 'BLR_MSTM_SH_PRESS_01', 'Áp hơi chính', 'MPa', 3, 0, [{ when: 'lt', value: 16, sev: 2 }]),
      barTile('fwcv', 'BLR_FW_CV_01', 'Van nước cấp (OP)', 0, 1, 1),
      valueTile('temp', 'BLR_MSTM_SH_TEMP_01', 'Nhiệt hơi SH', '°C', 1, 1, [{ when: 'gt', value: 550, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-boiler-combustion',
    level: 'D3',
    title: { vi: 'Đốt & gió', en: 'Combustion & Air' },
    elements: [
      valueTile('coal', 'BLR_COAL_FLOW_01', 'Lưu lượng than', 't/h', 0, 0),
      valueTile('o2', 'BLR_FLUE_O2_01', 'O₂ khói', '%', 1, 0, [{ when: 'lt', value: 1.5, sev: 2 }]),
      valueTile('furnace', 'BLR_FURN_PRESS_01', 'Áp buồng lửa', 'Pa', 2, 0, [
        { when: 'gt', value: 200, sev: 1 },
        { when: 'lt', value: -200, sev: 1 },
      ]),
      valueTile('mw', 'GEN_MW_01', 'Công suất', 'MW', 3, 0),
      barTile('firing', 'BLR_FIRING_DEMAND', 'Firing demand', 0, 1, 1),
      barTile('fd', 'BLR_FD_DAMPER_01', 'FD damper', 1, 1, 1),
      barTile('idvane', 'BLR_ID_VANE_01', 'ID guide vane', 2, 1, 1),
      barTile('o2bar', 'BLR_FLUE_O2_01', 'O₂ (0–21%)', 3, 1, 100 / 21),
    ],
  },
  {
    screenId: 'D3-turbine-generator',
    level: 'D3',
    title: { vi: 'Turbine & Máy phát', en: 'Turbine & Generator' },
    elements: [
      valueTile('mw', 'GEN_MW_01', 'Công suất', 'MW', 0, 0),
      valueTile('speed', 'TRB_SPEED_01', 'Tốc độ turbine', 'rpm', 1, 0, [{ when: 'gt', value: 3120, sev: 1 }]),
      valueTile('freq', 'GEN_FREQ_01', 'Tần số', 'Hz', 2, 0, [
        { when: 'gt', value: 50.5, sev: 2 },
        { when: 'lt', value: 49.5, sev: 2 },
      ]),
      valueTile('mvar', 'GEN_MVAR_01', 'Công suất phản kháng', 'MVAr', 3, 0),
      valueTile('stodola', 'TRB_STODOLA_FLOW', 'Lưu lượng Stodola', 't/h', 0, 1),
      valueTile('stator', 'GEN_STATOR_TEMP_01', 'Nhiệt cuộn stator', '°C', 1, 1, [{ when: 'gt', value: 120, sev: 2 }]),
      valueTile('vac', 'TRB_COND_VACUUM_01', 'Chân không bình ngưng', 'kPa', 2, 1, [{ when: 'gt', value: 12, sev: 2 }]),
    ],
  },
];

/** Tất cả tag mà một screen tham chiếu (để subscribe theo màn hình — Tag/Realtime). */
export function screenTags(screen: ScreenDef): string[] {
  const set = new Set<string>();
  for (const el of screen.elements) for (const b of el.bindings) set.add(b.tag);
  return [...set];
}
