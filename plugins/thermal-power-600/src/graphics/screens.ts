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

/** Thiết bị trên sơ đồ mimic: hình khối (shape) + giá trị sống + click drill vào màn hệ thống (nav). */
function equip(
  id: string,
  shape: string,
  label: string,
  tag: string,
  unit: string,
  nav: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alarms: AlarmCond[] = [],
): ScreenElement {
  const bindings: Binding[] = [{ property: 'text', tag, transform: { kind: 'linear', scale: 1 } }];
  for (const a of alarms) {
    bindings.push({ property: 'fill', tag, condition: { when: a.when, value: a.value, then: { fill: `var(--alarm-${a.sev})` } } });
  }
  bindings.push({ property: 'fill', tag, condition: { when: 'bad', then: { fill: 'var(--bad-quality)' } } });
  return { id, symbol: 'equipment', shape, nav, x, y, w, h, label, unit, bindings };
}

/** Đường ống nối thiết bị trên mimic: polyline theo môi chất (steam·water·flue·elec·shaft). */
function pipe(id: string, medium: string, points: ReadonlyArray<{ x: number; y: number }>): ScreenElement {
  return { id, symbol: 'pipe', medium, points, x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, bindings: [] };
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
    // Sơ đồ mimic sống (process graphic) — dòng hơi-nước + khói + điện; click thiết bị → drill D3.
    screenId: 'D1-plant-mimic',
    level: 'D1',
    title: { vi: 'Sơ đồ nhà máy (live)', en: 'Plant Mimic (live)' },
    elements: [
      // Đường ống (vẽ nền trước)
      pipe('p-riser', 'water', [{ x: 120, y: 250 }, { x: 120, y: 170 }]),
      pipe('p-drum-sh', 'steam', [{ x: 176, y: 144 }, { x: 236, y: 144 }]),
      pipe('p-sh-trb', 'steam', [{ x: 348, y: 144 }, { x: 420, y: 150 }]),
      pipe('p-trb-gen', 'shaft', [{ x: 560, y: 164 }, { x: 610, y: 165 }]),
      pipe('p-gen-grid', 'elec', [{ x: 696, y: 165 }, { x: 772, y: 165 }]),
      pipe('p-trb-cond', 'steam', [{ x: 490, y: 212 }, { x: 490, y: 318 }]),
      pipe('p-cond-bfp', 'water', [{ x: 420, y: 351 }, { x: 316, y: 361 }]),
      pipe('p-bfp-fur', 'water', [{ x: 250, y: 361 }, { x: 210, y: 361 }, { x: 210, y: 325 }, { x: 180, y: 325 }]),
      pipe('p-fur-stack', 'flue', [{ x: 160, y: 250 }, { x: 160, y: 90 }, { x: 321, y: 90 }, { x: 321, y: 112 }]),
      // Thiết bị (click → drill vào màn hệ thống D3)
      equip('m-furnace', 'furnace', 'Buồng lửa', 'BLR_FURN_PRESS_01', 'Pa', 'D3-furnace', 60, 250, 120, 150, [
        { when: 'gt', value: 200, sev: 1 },
        { when: 'lt', value: -200, sev: 1 },
      ]),
      equip('m-drum', 'drum', 'Bao hơi', 'BLR_DRUM_LEVEL_01', 'mm', 'D3-steam-drum', 64, 118, 112, 52, [
        { when: 'gt', value: 250, sev: 1 },
        { when: 'lt', value: -250, sev: 1 },
      ]),
      equip('m-sh', 'superheater', 'Quá nhiệt', 'BLR_MSTM_SH_TEMP_01', '°C', 'D3-superheater', 236, 118, 112, 52, [
        { when: 'gt', value: 550, sev: 2 },
      ]),
      equip('m-turbine', 'turbine', 'Turbine', 'BLR_STEAM_FLOW_01', 't/h', 'D3-turbine', 420, 116, 140, 96),
      equip('m-gen', 'generator', 'Máy phát', 'GEN_MW_01', 'MW', 'D3-generator', 610, 122, 86, 86),
      equip('m-grid', 'grid', 'Xuất lưới 500kV', 'ELEC_GRID_MW_01', 'MW', 'D3-electrical', 772, 136, 120, 58),
      equip('m-cond', 'condenser', 'Bình ngưng', 'TRB_COND_VACUUM_01', 'kPa', 'D3-condenser-cw', 420, 318, 140, 66, [
        { when: 'gt', value: 12, sev: 2 },
      ]),
      equip('m-bfp', 'pump', 'Bơm cấp', 'FW_FLOW_01', 't/h', 'D3-feedwater-heatrate', 250, 328, 66, 66),
      equip('m-stack', 'stack', 'Ống khói', 'BLR_FLUE_O2_01', '%', 'D3-flue-stack', 300, 28, 42, 84, [
        { when: 'lt', value: 1.5, sev: 2 },
      ]),
      // v2: vòng nước làm mát (CW) + gió cháy + khử SO₂
      pipe('p-cond-ct', 'water', [{ x: 560, y: 351 }, { x: 612, y: 342 }]),
      pipe('p-ct-cond', 'water', [{ x: 668, y: 384 }, { x: 668, y: 410 }, { x: 490, y: 410 }, { x: 490, y: 384 }]),
      pipe('p-fd-fur', 'air', [{ x: 102, y: 428 }, { x: 102, y: 400 }]),
      equip('m-fgd', 'box', 'Khử SO₂ FGD', 'EMI_FGD_EFF_01', '%', 'D3-emissions-cems', 185, 66, 92, 48),
      equip('m-ct', 'box', 'Tháp giải nhiệt', 'CT_CW_SUPPLY_01', '°C', 'D3-cooling-tower', 612, 300, 112, 84),
      equip('m-fd', 'pump', 'Quạt gió FD', 'PLANT_AIR_FLOW_01', 't/h', 'D3-fd-fan', 66, 428, 72, 72),
    ],
  },
  {
    // Sơ đồ MỘT SỢI điện (SLD): máy phát → GSU → thanh cái 500 kV → đường dây; nhánh UAT → tự dùng 6,6 kV.
    screenId: 'D1-electrical-sld',
    level: 'D1',
    title: { vi: 'Sơ đồ một sợi điện (SLD)', en: 'Electrical Single-Line' },
    elements: [
      pipe('e-gen-gsu', 'elec', [{ x: 364, y: 118 }, { x: 364, y: 158 }]),
      pipe('e-gsu-bus', 'elec', [{ x: 364, y: 220 }, { x: 364, y: 280 }]),
      pipe('e-bus-line', 'elec', [{ x: 560, y: 318 }, { x: 560, y: 360 }]),
      pipe('e-bus-uat', 'elec', [{ x: 200, y: 318 }, { x: 200, y: 358 }]),
      pipe('e-uat-aux', 'elec', [{ x: 200, y: 420 }, { x: 200, y: 430 }]),
      equip('e-gen', 'generator', 'Máy phát', 'GEN_MW_01', 'MW', 'D3-generator', 320, 30, 88, 88),
      equip('e-gsu', 'transformer', 'GSU tăng áp', 'ELEC_GSU_LOADING_01', '%', 'D3-electrical', 336, 158, 56, 62, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('e-bus', 'box', 'Thanh cái 500 kV', 'ELEC_GRID_MW_01', 'MW', 'D3-electrical', 120, 280, 520, 38),
      equip('e-line', 'grid', 'Đường dây 500 kV', 'ELEC_GRID_MW_01', 'MW', 'D3-electrical', 505, 360, 135, 56),
      equip('e-uat', 'transformer', 'UAT tự dùng', 'ELEC_AUX_LOADING_01', '%', 'D3-electrical', 172, 358, 56, 62, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('e-aux', 'box', 'Tự dùng 6,6 kV', 'ELEC_AUX_POWER_01', 'MW', 'D3-electrical', 110, 430, 180, 46),
    ],
  },
  // ── Màn chi tiết RIÊNG cho từng khối mimic (click khối → mở đúng màn của khối đó) ──
  {
    // Sơ đồ BỐ TRÍ THIẾT BỊ hệ lò hơi (mimic): buồng lửa · bao hơi · SH · bộ hâm · sấy gió · quạt · ống khói.
    screenId: 'D3-furnace',
    level: 'D3',
    title: { vi: 'Lò hơi — bố trí thiết bị', en: 'Boiler — Equipment Layout' },
    elements: [
      // Ống: nước (xanh) · hơi (cam) · khói (xám) · gió (lam) · than (xám đậm)
      pipe('bp-coal', 'shaft', [{ x: 100, y: 272 }, { x: 124, y: 272 }]),
      pipe('bp-riser', 'water', [{ x: 190, y: 170 }, { x: 190, y: 156 }]),
      pipe('bp-drum-sh', 'steam', [{ x: 244, y: 130 }, { x: 353, y: 130 }, { x: 353, y: 138 }]),
      pipe('bp-sh-out', 'steam', [{ x: 353, y: 138 }, { x: 353, y: 84 }, { x: 470, y: 84 }]),
      pipe('bp-fl-sh', 'flue', [{ x: 245, y: 170 }, { x: 245, y: 165 }, { x: 306, y: 165 }]),
      pipe('bp-fl-eco', 'flue', [{ x: 400, y: 165 }, { x: 424, y: 165 }]),
      pipe('bp-fl-ah', 'flue', [{ x: 518, y: 165 }, { x: 542, y: 165 }]),
      pipe('bp-fl-id', 'flue', [{ x: 636, y: 165 }, { x: 660, y: 168 }]),
      pipe('bp-fl-stack', 'flue', [{ x: 689, y: 198 }, { x: 689, y: 225 }, { x: 713, y: 225 }, { x: 713, y: 250 }]),
      pipe('bp-air', 'air', [{ x: 208, y: 427 }, { x: 589, y: 427 }, { x: 589, y: 192 }]),
      pipe('bp-eco-drum', 'water', [{ x: 471, y: 138 }, { x: 471, y: 78 }, { x: 190, y: 78 }, { x: 190, y: 104 }]),
      // Thiết bị (click → màn chi tiết liên quan)
      equip('bf-coal', 'box', 'Cấp than', 'BLR_COAL_FLOW_01', 't/h', 'D3-coal-handling', 14, 250, 86, 44),
      equip('bf-drum', 'drum', 'Bao hơi', 'BLR_DRUM_LEVEL_01', 'mm', 'D3-steam-drum', 136, 104, 108, 52, [{ when: 'gt', value: 250, sev: 1 }, { when: 'lt', value: -250, sev: 1 }]),
      equip('bf-furnace', 'furnace', 'Buồng lửa', 'BLR_FURN_PRESS_01', 'Pa', 'D3-fd-fan', 124, 170, 132, 210, [{ when: 'gt', value: 200, sev: 1 }, { when: 'lt', value: -200, sev: 1 }]),
      equip('bf-fd', 'pump', 'Quạt gió FD', 'PLANT_AIR_FLOW_01', 't/h', 'D3-fd-fan', 150, 398, 58, 58),
      equip('bf-sh', 'box', 'Bộ quá nhiệt', 'BLR_MSTM_SH_TEMP_01', '°C', 'D3-superheater', 306, 138, 94, 54, [{ when: 'gt', value: 550, sev: 2 }]),
      equip('bf-eco', 'box', 'Bộ hâm ECO', 'FW_ECON_INLET_TEMP_01', '°C', 'D3-feedwater-heatrate', 424, 138, 94, 54),
      equip('bf-ah', 'box', 'Sấy gió AH', 'AH_AIR_OUT_TEMP_01', '°C', 'D3-fd-fan', 542, 138, 94, 54),
      equip('bf-id', 'pump', 'Quạt khói ID', 'FG_FLOW_01', 't/h', 'D3-fd-fan', 660, 140, 58, 58),
      equip('bf-stack', 'stack', 'Ống khói', 'FG_STACK_TEMP_01', '°C', 'D3-flue-stack', 690, 250, 46, 130, [{ when: 'gt', value: 150, sev: 3 }]),
    ],
  },
  {
    screenId: 'D3-superheater',
    level: 'D3',
    title: { vi: 'Quá nhiệt & tái nhiệt', en: 'Superheater & Reheat' },
    elements: [
      valueTile('shtemp', 'BLR_MSTM_SH_TEMP_01', 'Nhiệt hơi SH', '°C', 0, 0, [{ when: 'gt', value: 550, sev: 2 }]),
      valueTile('shpress', 'BLR_MSTM_SH_PRESS_01', 'Áp hơi chính', 'MPa', 1, 0, [{ when: 'gt', value: 19, sev: 2 }, { when: 'lt', value: 16, sev: 2 }]),
      valueTile('steam', 'BLR_STEAM_FLOW_01', 'Hơi chính', 't/h', 2, 0),
      valueTile('rhduty', 'TRB_REHEAT_DUTY_01', 'Nhiệt reheater', 'MWth', 3, 0),
      valueTile('crhp', 'TRB_CRH_PRESS_01', 'Áp cold reheat', 'MPa', 0, 1),
      valueTile('crht', 'TRB_CRH_TEMP_01', 'Nhiệt cold reheat', '°C', 1, 1),
      valueTile('hrhp', 'TRB_HRH_PRESS_01', 'Áp hot reheat', 'MPa', 2, 1),
      valueTile('hrht', 'TRB_HRH_TEMP_01', 'Nhiệt hot reheat', '°C', 3, 1, [{ when: 'lt', value: 500, sev: 2 }]),
      barTile('spray', 'BLR_SH_SPRAY_CV_01', 'Van phun giảm ôn', 0, 2, 1),
    ],
  },
  {
    screenId: 'D3-turbine',
    level: 'D3',
    title: { vi: 'Turbine hơi (HP/IP/LP)', en: 'Steam Turbine' },
    elements: [
      valueTile('speed', 'TRB_SPEED_01', 'Tốc độ turbine', 'rpm', 0, 0, [{ when: 'gt', value: 3120, sev: 1 }]),
      valueTile('steam', 'BLR_STEAM_FLOW_01', 'Hơi vào turbine', 't/h', 1, 0),
      valueTile('stodola', 'TRB_STODOLA_FLOW', 'Lưu lượng Stodola', 't/h', 2, 0),
      valueTile('vac', 'TRB_COND_VACUUM_01', 'Chân không bình ngưng', 'kPa', 3, 0, [{ when: 'gt', value: 12, sev: 2 }]),
      valueTile('hpmw', 'TRB_HP_MW_01', 'Công suất HP', 'MW', 0, 1),
      valueTile('ipmw', 'TRB_IP_MW_01', 'Công suất IP', 'MW', 1, 1),
      valueTile('lpmw', 'TRB_LP_MW_01', 'Công suất LP', 'MW', 2, 1),
      valueTile('rhduty', 'TRB_REHEAT_DUTY_01', 'Nhiệt reheater', 'MWth', 3, 1),
      valueTile('crht', 'TRB_CRH_TEMP_01', 'Nhiệt cold reheat', '°C', 0, 2),
      valueTile('hrht', 'TRB_HRH_TEMP_01', 'Nhiệt hot reheat', '°C', 1, 2),
    ],
  },
  {
    screenId: 'D3-generator',
    level: 'D3',
    title: { vi: 'Máy phát & xuất tuyến', en: 'Generator & Output' },
    elements: [
      valueTile('mw', 'GEN_MW_01', 'Công suất tác dụng', 'MW', 0, 0),
      valueTile('mvar', 'GEN_MVAR_01', 'Công suất phản kháng', 'MVAr', 1, 0),
      valueTile('freq', 'GEN_FREQ_01', 'Tần số', 'Hz', 2, 0, [{ when: 'gt', value: 50.5, sev: 2 }, { when: 'lt', value: 49.5, sev: 2 }]),
      valueTile('mva', 'ELEC_GEN_MVA_01', 'Công suất biểu kiến', 'MVA', 3, 0),
      valueTile('stator', 'GEN_STATOR_TEMP_01', 'Nhiệt cuộn stator', '°C', 0, 1, [{ when: 'gt', value: 120, sev: 2 }]),
      valueTile('cur', 'ELEC_GEN_CURRENT_01', 'Dòng stator', 'kA', 1, 1),
      valueTile('pf', 'ELEC_PF_01', 'Hệ số công suất', '', 2, 1, [{ when: 'lt', value: 0.85, sev: 3 }]),
      valueTile('gsu', 'ELEC_GSU_LOADING_01', 'Tải GSU', '%', 3, 1, [{ when: 'gt', value: 100, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-flue-stack',
    level: 'D3',
    title: { vi: 'Đường khói & ống khói', en: 'Flue Gas & Stack' },
    elements: [
      valueTile('fgflow', 'FG_FLOW_01', 'Lưu lượng khói', 't/h', 0, 0),
      valueTile('o2', 'BLR_FLUE_O2_01', 'O₂ khói', '%', 1, 0, [{ when: 'lt', value: 1.5, sev: 2 }]),
      valueTile('exair', 'FG_EXCESS_AIR_01', 'Gió thừa', '%', 2, 0, [{ when: 'gt', value: 40, sev: 2 }]),
      valueTile('lambda', 'FG_LAMBDA_01', 'Tỷ số gió λ', '', 3, 0),
      valueTile('stack', 'FG_STACK_TEMP_01', 'Nhiệt ống khói', '°C', 0, 1, [{ when: 'gt', value: 150, sev: 3 }]),
      valueTile('ahgas', 'FG_AH_GAS_IN_TEMP_01', 'Khói vào air heater', '°C', 1, 1),
      valueTile('beff', 'BLR_EFF_01', 'Hiệu suất lò', '%', 2, 1, [{ when: 'lt', value: 82, sev: 2 }]),
      valueTile('dgloss', 'FG_DRYGAS_LOSS_01', 'Tổn thất khói khô', '%', 3, 1),
    ],
  },
  {
    screenId: 'D3-fd-fan',
    level: 'D3',
    title: { vi: 'Quạt gió & gió cháy', en: 'FD Fan & Combustion Air' },
    elements: [
      valueTile('air', 'PLANT_AIR_FLOW_01', 'Gió cháy', 't/h', 0, 0),
      valueTile('furn', 'BLR_FURN_PRESS_01', 'Áp buồng lửa', 'Pa', 1, 0, [{ when: 'gt', value: 200, sev: 1 }, { when: 'lt', value: -200, sev: 1 }]),
      valueTile('airout', 'AH_AIR_OUT_TEMP_01', 'Gió cháy sau AH', '°C', 2, 0),
      valueTile('lambda', 'FG_LAMBDA_01', 'Tỷ số gió λ', '', 3, 0),
      barTile('fd', 'BLR_FD_DAMPER_01', 'FD damper', 0, 1, 1),
      barTile('idvane', 'BLR_ID_VANE_01', 'ID guide vane', 1, 1, 1),
      barTile('o2bar', 'BLR_FLUE_O2_01', 'O₂ (0–21%)', 2, 1, 100 / 21),
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
  {
    screenId: 'D3-coal-handling',
    level: 'D3',
    title: { vi: 'Cung cấp than', en: 'Coal Handling' },
    elements: [
      // Cung cấp than (v1.25): bunker → feeder → mill; băng tải cấp; dự trữ yard.
      valueTile('cons', 'COAL_CONSUMPTION_01', 'Tiêu thụ than', 't/h', 0, 0),
      valueTile('bunker', 'COAL_BUNKER_LEVEL_01', 'Mức bunker', '%', 1, 0, [{ when: 'lt', value: 30, sev: 2 }]),
      valueTile('conv', 'COAL_CONVEYOR_FEED_01', 'Băng tải cấp', 't/h', 2, 0),
      valueTile('mills', 'COAL_MILLS_RUNNING_01', 'Máy nghiền chạy', '', 3, 0),
      valueTile('mload', 'COAL_MILL_LOADING_01', 'Tải máy nghiền', '%', 0, 1, [{ when: 'gt', value: 100, sev: 2 }]),
      valueTile('feeder', 'COAL_FEEDER_RATE_01', 'Suất feeder', 't/h', 1, 1),
      valueTile('yard', 'COAL_YARD_DAYS_01', 'Dự trữ yard', 'ngày', 2, 1, [{ when: 'lt', value: 7, sev: 2 }]),
    ],
  },
  {
    screenId: 'D2-plant-balance',
    level: 'D2',
    title: { vi: 'Cân bằng năng lượng nhà máy', en: 'Plant Energy Balance' },
    elements: [
      // CAPSTONE (v1.26): kiểm chứng chéo bảo toàn năng lượng + KPI toàn nhà máy.
      valueTile('ein', 'PLANT_ENERGY_IN_01', 'Nhiệt nhiên liệu', 'MWth', 0, 0),
      valueTile('reject', 'PLANT_HEAT_REJECT_01', 'Nhiệt thải bình ngưng', 'MWth', 1, 0),
      valueTile('bloss', 'PLANT_BOILER_LOSS_01', 'Tổn thất lò', 'MWth', 2, 0),
      valueTile('clo', 'PLANT_ENERGY_CLOSURE_01', 'Khép cân bằng NL', '%', 3, 0, [{ when: 'lt', value: 97, sev: 2 }, { when: 'gt', value: 103, sev: 2 }]),
      valueTile('neff', 'PLANT_NET_EFF_01', 'Hiệu suất net', '%', 0, 1),
      valueTile('uhr', 'PLANT_UNIT_HR_NET_01', 'Heat rate đơn vị (net)', 'kJ/kWh', 1, 1),
      valueTile('co2i', 'PLANT_CO2_INTENSITY_01', 'Cường độ CO₂', 'g/kWh', 2, 1),
      valueTile('air', 'PLANT_AIR_FLOW_01', 'Gió cháy', 't/h', 3, 1),
    ],
  },
];

/** Tất cả tag mà một screen tham chiếu (để subscribe theo màn hình — Tag/Realtime). */
export function screenTags(screen: ScreenDef): string[] {
  const set = new Set<string>();
  for (const el of screen.elements) for (const b of el.bindings) set.add(b.tag);
  return [...set];
}
