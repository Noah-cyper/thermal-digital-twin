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
      // Chu trình tái nhiệt + tách công suất tầng (v1.18) — HP+IP+LP cộng lại = công suất trục.
      valueTile('hpmw', 'TRB_HP_MW_01', 'Công suất HP', 'MW', 0, 2),
      valueTile('ipmw', 'TRB_IP_MW_01', 'Công suất IP', 'MW', 1, 2),
      valueTile('lpmw', 'TRB_LP_MW_01', 'Công suất LP', 'MW', 2, 2),
      valueTile('rhduty', 'TRB_REHEAT_DUTY_01', 'Nhiệt lượng reheater', 'MWth', 3, 2),
      valueTile('crhp', 'TRB_CRH_PRESS_01', 'Áp cold reheat', 'MPa', 0, 3),
      valueTile('crht', 'TRB_CRH_TEMP_01', 'Nhiệt cold reheat', '°C', 1, 3),
      valueTile('hrhp', 'TRB_HRH_PRESS_01', 'Áp hot reheat', 'MPa', 2, 3),
      valueTile('hrht', 'TRB_HRH_TEMP_01', 'Nhiệt hot reheat', '°C', 3, 3, [{ when: 'lt', value: 500, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-feedwater-heatrate',
    level: 'D3',
    title: { vi: 'Nước cấp & Heat Rate', en: 'Feed Water & Heat Rate' },
    elements: [
      // Đoàn gia nhiệt hồi nhiệt (v1.19): condensate → 4 LP heater → deaerator → BFP → 3 HP heater → econ.
      valueTile('fwflow', 'FW_FLOW_01', 'Lưu lượng nước cấp', 't/h', 0, 0),
      valueTile('cond', 'FW_CONDENSATE_TEMP_01', 'Nhiệt condensate', '°C', 1, 0),
      valueTile('dea', 'FW_DEAERATOR_TEMP_01', 'Nhiệt deaerator', '°C', 2, 0),
      valueTile('econ', 'FW_ECON_INLET_TEMP_01', 'Nước cấp vào economizer', '°C', 3, 0, [{ when: 'lt', value: 200, sev: 3 }]),
      valueTile('regen', 'FW_REGEN_DUTY_01', 'Nhiệt hồi nhiệt', 'MWth', 0, 1),
      valueTile('hr', 'PLANT_CYCLE_HR_01', 'Heat rate chu trình', 'kJ/kWh', 1, 1, [{ when: 'gt', value: 9500, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-condenser-cw',
    level: 'D3',
    title: { vi: 'Bình ngưng & Nước tuần hoàn', en: 'Condenser & Circulating Water' },
    elements: [
      // Bình ngưng + CW (v1.20): cân bằng năng lượng — nhiệt thải, phía nước tuần hoàn 64.000 m³/h.
      valueTile('cduty', 'COND_DUTY_01', 'Nhiệt thải bình ngưng', 'MWth', 0, 0),
      valueTile('csat', 'COND_SAT_TEMP_01', 'Nhiệt bão hoà', '°C', 1, 0, [{ when: 'gt', value: 45, sev: 2 }]),
      valueTile('cttd', 'COND_TTD_01', 'TTD', '°C', 2, 0),
      valueTile('cwflow', 'COND_CW_FLOW_01', 'Lưu lượng CW', 't/h', 3, 0),
      valueTile('cwin', 'COND_CW_IN_TEMP_01', 'CW vào', '°C', 0, 1),
      valueTile('cwout', 'COND_CW_OUT_TEMP_01', 'CW ra', '°C', 1, 1, [{ when: 'gt', value: 42, sev: 3 }]),
      valueTile('cwrise', 'COND_CW_RISE_01', 'Độ tăng nhiệt CW', '°C', 2, 1),
    ],
  },
  {
    screenId: 'D3-fluegas-air',
    level: 'D3',
    title: { vi: 'Đường khói & Hiệu suất lò', en: 'Flue Gas & Boiler Efficiency' },
    elements: [
      // Đường khói + gió cháy + hiệu suất lò (v1.21): khép kín cân bằng năng lượng phía nhiên liệu.
      valueTile('beff', 'BLR_EFF_01', 'Hiệu suất lò', '%', 0, 0, [{ when: 'lt', value: 82, sev: 2 }]),
      valueTile('exair', 'FG_EXCESS_AIR_01', 'Gió thừa', '%', 1, 0, [{ when: 'gt', value: 40, sev: 2 }]),
      valueTile('lambda', 'FG_LAMBDA_01', 'Tỷ số gió λ', '', 2, 0),
      valueTile('fgflow', 'FG_FLOW_01', 'Lưu lượng khói', 't/h', 3, 0),
      valueTile('ahgas', 'FG_AH_GAS_IN_TEMP_01', 'Khói vào air heater', '°C', 0, 1),
      valueTile('stack', 'FG_STACK_TEMP_01', 'Nhiệt ống khói', '°C', 1, 1, [{ when: 'gt', value: 150, sev: 3 }]),
      valueTile('airout', 'AH_AIR_OUT_TEMP_01', 'Gió cháy sau AH', '°C', 2, 1),
      valueTile('dgloss', 'FG_DRYGAS_LOSS_01', 'Tổn thất khói khô', '%', 3, 1),
    ],
  },
  {
    screenId: 'D3-emissions-cems',
    level: 'D3',
    title: { vi: 'Phát thải (CEMS)', en: 'Emissions (CEMS)' },
    elements: [
      // Phát thải CEMS (v1.22): sau ESP + FGD, quy về nồng độ mg/Nm³ + tải CO₂.
      valueTile('dust', 'EMI_DUST_STACK_01', 'Bụi ra ống khói', 'mg/Nm³', 0, 0, [{ when: 'gt', value: 30, sev: 2 }]),
      valueTile('so2', 'EMI_SO2_STACK_01', 'SO₂ ra ống khói', 'mg/Nm³', 1, 0, [{ when: 'gt', value: 200, sev: 2 }]),
      valueTile('nox', 'EMI_NOX_STACK_01', 'NOₓ ra ống khói', 'mg/Nm³', 2, 0, [{ when: 'gt', value: 500, sev: 2 }]),
      valueTile('co2', 'EMI_CO2_RATE_01', 'Phát thải CO₂', 't/h', 3, 0),
      valueTile('fgvol', 'EMI_FG_VOLUME_01', 'Lưu lượng khói', 'Nm³/h', 0, 1),
      valueTile('esp', 'EMI_ESP_EFF_01', 'Độ khử bụi ESP', '%', 1, 1),
      valueTile('fgd', 'EMI_FGD_EFF_01', 'Độ khử SO₂ FGD', '%', 2, 1),
    ],
  },
  {
    screenId: 'D3-electrical',
    level: 'D3',
    title: { vi: 'Điện & Xuất lưới', en: 'Electrical & Grid Export' },
    elements: [
      // Phía điện (v1.23): máy phát 667 MVA/20 kV → GSU 20/500 kV → lưới 500 kV; tự dùng qua UAT.
      valueTile('net', 'ELEC_NET_MW_01', 'Công suất tinh (net)', 'MW', 0, 0),
      valueTile('aux', 'ELEC_AUX_POWER_01', 'Tự dùng', 'MW', 1, 0),
      valueTile('grid', 'ELEC_GRID_MW_01', 'Xuất lưới 500 kV', 'MW', 2, 0),
      valueTile('mva', 'ELEC_GEN_MVA_01', 'Công suất biểu kiến', 'MVA', 3, 0),
      valueTile('pf', 'ELEC_PF_01', 'Hệ số công suất', '', 0, 1, [{ when: 'lt', value: 0.85, sev: 3 }]),
      valueTile('cur', 'ELEC_GEN_CURRENT_01', 'Dòng stator', 'kA', 1, 1),
      valueTile('gsu', 'ELEC_GSU_LOADING_01', 'Tải GSU', '%', 2, 1, [{ when: 'gt', value: 100, sev: 2 }]),
      valueTile('uat', 'ELEC_AUX_LOADING_01', 'Tải UAT', '%', 3, 1, [{ when: 'gt', value: 100, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-cooling-tower',
    level: 'D3',
    title: { vi: 'Tháp làm mát', en: 'Cooling Tower' },
    elements: [
      // Tháp làm mát natural draft (v1.24): khép vòng CW — bầu ướt + approach + bốc hơi + nước bổ sung.
      valueTile('reject', 'CT_HEAT_REJECT_01', 'Nhiệt thải khí quyển', 'MWth', 0, 0),
      valueTile('wb', 'CT_WETBULB_01', 'Bầu ướt', '°C', 1, 0),
      valueTile('supply', 'CT_CW_SUPPLY_01', 'CW cấp (lạnh)', '°C', 2, 0),
      valueTile('approach', 'CT_APPROACH_01', 'Approach', '°C', 3, 0),
      valueTile('range', 'CT_RANGE_01', 'Range', '°C', 0, 1),
      valueTile('evap', 'CT_EVAP_LOSS_01', 'Bốc hơi', 't/h', 1, 1),
      valueTile('makeup', 'CT_MAKEUP_01', 'Nước bổ sung', 't/h', 2, 1),
    ],
  },
];

/** Tất cả tag mà một screen tham chiếu (để subscribe theo màn hình — Tag/Realtime). */
export function screenTags(screen: ScreenDef): string[] {
  const set = new Set<string>();
  for (const el of screen.elements) for (const b of el.bindings) set.add(b.tag);
  return [...set];
}
