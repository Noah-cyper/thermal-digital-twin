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

interface FlowItem {
  id: string;
  shape: string;
  label: string;
  tag: string;
  unit: string;
  nav?: string;
  w?: number;
  h?: number;
  alarms?: AlarmCond[];
}

/**
 * Chuỗi thiết bị nối tiếp TRÁI→PHẢI trên một trục ngang (centerY): tự giãn cách (không đè nhau) và tự
 * nối ống giữa hai thiết bị liền kề theo môi chất. Dùng cho các hệ dạng dòng chảy tuyến tính (nước cấp,
 * đường khói, đường gió, cấp than, trục turbine). Trả về mảng phần tử (pipe + equipment) để chèn thẳng.
 */
function flow(centerY: number, medium: string, items: ReadonlyArray<FlowItem>, x0 = 20, gap = 44): ScreenElement[] {
  const out: ScreenElement[] = [];
  let x = x0;
  let prevRight: number | null = null;
  for (const it of items) {
    const w = it.w ?? 112;
    const h = it.h ?? 56;
    const y = Math.round(centerY - h / 2);
    if (prevRight !== null) out.push(pipe(`${it.id}-in`, medium, [{ x: prevRight, y: centerY }, { x, y: centerY }]));
    out.push(equip(it.id, it.shape, it.label, it.tag, it.unit, it.nav ?? '', x, y, w, h, it.alarms ?? []));
    prevRight = x + w;
    x = prevRight + gap;
  }
  return out;
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
    title: { vi: 'Quá nhiệt & tái nhiệt — bố trí thiết bị', en: 'Superheater & Reheat Layout' },
    elements: [
      // Dòng hơi chính: bao hơi → bộ quá nhiệt (van giảm ôn phun nước) → góp hơi chính ra turbine.
      ...flow(100, 'steam', [
        { id: 'sh-drum', shape: 'drum', label: 'Bao hơi', tag: 'BLR_DRUM_LEVEL_01', unit: 'mm', nav: 'D3-steam-drum', w: 120, h: 56 },
        { id: 'sh-sh', shape: 'box', label: 'Bộ quá nhiệt', tag: 'BLR_MSTM_SH_TEMP_01', unit: '°C', w: 132, h: 62, alarms: [{ when: 'gt', value: 550, sev: 2 }] },
        { id: 'sh-header', shape: 'box', label: 'Góp hơi chính (áp)', tag: 'BLR_MSTM_SH_PRESS_01', unit: 'MPa', w: 132, h: 62, alarms: [{ when: 'gt', value: 19, sev: 2 }, { when: 'lt', value: 16, sev: 2 }] },
      ], 30, 70),
      pipe('sh-spray-p', 'water', [{ x: 296, y: 190 }, { x: 296, y: 131 }]),
      equip('sh-spray', 'box', 'Van giảm ôn (OP)', 'BLR_SH_SPRAY_CV_01', '%', '', 230, 190, 132, 54),
      pipe('sh-out', 'steam', [{ x: 552, y: 100 }, { x: 590, y: 100 }]),
      equip('sh-flow', 'box', 'Lưu lượng hơi chính', 'BLR_STEAM_FLOW_01', 't/h', '', 590, 72, 140, 56),
      // Nhánh tái nhiệt: cold-reheat từ xả HP → bộ tái nhiệt → hot-reheat về IP.
      ...flow(270, 'steam', [
        { id: 'rh-crh', shape: 'box', label: 'Cold reheat', tag: 'TRB_CRH_TEMP_01', unit: '°C', w: 140, h: 56 },
        { id: 'rh-reheater', shape: 'box', label: 'Bộ tái nhiệt', tag: 'TRB_REHEAT_DUTY_01', unit: 'MWth', w: 140, h: 56 },
        { id: 'rh-hrh', shape: 'box', label: 'Hot reheat', tag: 'TRB_HRH_TEMP_01', unit: '°C', w: 140, h: 56, alarms: [{ when: 'lt', value: 500, sev: 2 }] },
      ], 30, 60),
      equip('rh-crhp', 'box', 'Áp cold reheat', 'TRB_CRH_PRESS_01', 'MPa', '', 590, 242, 140, 56),
      equip('rh-hrhp', 'box', 'Áp hot reheat', 'TRB_HRH_PRESS_01', 'MPa', '', 590, 310, 140, 56),
    ],
  },
  {
    screenId: 'D3-turbine',
    level: 'D3',
    title: { vi: 'Turbine hơi — bố trí thiết bị', en: 'Steam Turbine Layout' },
    elements: [
      // Trục turbine: hơi chính → HP → IP → LP → máy phát (cùng trục 3000 v/p). Nhánh tái nhiệt + xả về
      // bình ngưng vẽ riêng phía dưới.
      pipe('tb-msteam', 'steam', [{ x: 64, y: 20 }, { x: 64, y: 92 }]),
      equip('tb-msv', 'box', 'Hơi vào TB', 'TRB_STODOLA_FLOW', 't/h', '', 14, 92, 100, 56),
      pipe('tb-steam', 'steam', [{ x: 114, y: 120 }, { x: 140, y: 120 }]),
      ...flow(120, 'shaft', [
        { id: 'tb-hp', shape: 'turbine', label: 'HP', tag: 'TRB_HP_MW_01', unit: 'MW', nav: 'D3-turbine-generator', w: 108, h: 80 },
        { id: 'tb-ip', shape: 'turbine', label: 'IP', tag: 'TRB_IP_MW_01', unit: 'MW', nav: 'D3-turbine-generator', w: 108, h: 80 },
        { id: 'tb-lp', shape: 'turbine', label: 'LP', tag: 'TRB_LP_MW_01', unit: 'MW', nav: 'D3-turbine-generator', w: 150, h: 100 },
        { id: 'tb-gen', shape: 'generator', label: 'Máy phát', tag: 'GEN_MW_01', unit: 'MW', nav: 'D3-generator', w: 92, h: 92 },
      ], 140, 44),
      // Nhánh tái nhiệt: xả HP (cold reheat) → bộ tái nhiệt → hot reheat về IP.
      pipe('tb-crh', 'steam', [{ x: 194, y: 160 }, { x: 194, y: 277 }, { x: 280, y: 277 }]),
      equip('tb-reheat', 'box', 'Bộ tái nhiệt', 'TRB_REHEAT_DUTY_01', 'MWth', 'D3-superheater', 280, 250, 132, 54),
      pipe('tb-hrh', 'steam', [{ x: 412, y: 277 }, { x: 412, y: 200 }, { x: 346, y: 200 }, { x: 346, y: 160 }]),
      // Xả LP → bình ngưng (chân không).
      pipe('tb-lpx', 'steam', [{ x: 519, y: 170 }, { x: 519, y: 250 }]),
      equip('tb-cond', 'box', 'Bình ngưng (chân không)', 'TRB_COND_VACUUM_01', 'kPa', 'D3-condenser-cw', 453, 250, 132, 54, [{ when: 'gt', value: 12, sev: 2 }]),
      equip('tb-speed', 'box', 'Tốc độ trục', 'TRB_SPEED_01', 'rpm', '', 14, 250, 180, 54, [{ when: 'gt', value: 3120, sev: 1 }]),
    ],
  },
  {
    screenId: 'D3-generator',
    level: 'D3',
    title: { vi: 'Máy phát & xuất tuyến — sơ đồ một sợi', en: 'Generator Single-Line' },
    elements: [
      // Một sợi máy phát: kích từ (AVR) → máy phát 667 MVA/20 kV → MBA tăng áp GSU 20/500 kV → thanh cái
      // 500 kV. Dải thông số máy phát vẽ ngay dưới sợi.
      ...flow(130, 'elec', [
        { id: 'gn-exc', shape: 'box', label: 'Kích từ (Q)', tag: 'GEN_MVAR_01', unit: 'MVAr', w: 96, h: 56 },
        { id: 'gn-gen', shape: 'generator', label: 'Máy phát', tag: 'GEN_MW_01', unit: 'MW', w: 100, h: 100 },
        { id: 'gn-gsu', shape: 'transformer', label: 'GSU 20/500 kV', tag: 'ELEC_GSU_LOADING_01', unit: '%', nav: 'D3-electrical', w: 110, h: 100, alarms: [{ when: 'gt', value: 100, sev: 2 }] },
        { id: 'gn-line', shape: 'box', label: 'Thanh cái 500 kV', tag: 'ELEC_GRID_MW_01', unit: 'MW', nav: 'D3-electrical', w: 120, h: 56 },
      ], 20, 48),
      equip('gn-freq', 'box', 'Tần số', 'GEN_FREQ_01', 'Hz', '', 20, 250, 112, 54, [{ when: 'gt', value: 50.5, sev: 2 }, { when: 'lt', value: 49.5, sev: 2 }]),
      equip('gn-mva', 'box', 'Biểu kiến', 'ELEC_GEN_MVA_01', 'MVA', '', 146, 250, 112, 54),
      equip('gn-stator', 'box', 'Nhiệt stator', 'GEN_STATOR_TEMP_01', '°C', '', 272, 250, 112, 54, [{ when: 'gt', value: 120, sev: 2 }]),
      equip('gn-cur', 'box', 'Dòng stator', 'ELEC_GEN_CURRENT_01', 'kA', '', 398, 250, 112, 54),
      equip('gn-pf', 'box', 'Hệ số cs (cosφ)', 'ELEC_PF_01', '', '', 524, 250, 112, 54, [{ when: 'lt', value: 0.85, sev: 3 }]),
    ],
  },
  {
    screenId: 'D3-flue-stack',
    level: 'D3',
    title: { vi: 'Đường khói & ống khói — bố trí thiết bị', en: 'Flue Gas Path Layout' },
    elements: [
      // Đường khói: buồng lửa → bộ hâm/economizer → sấy gió (AH) → quạt khói ID → ống khói. Chỉ số cháy
      // (O₂/λ/gió thừa/hiệu suất) vẽ dưới đường khói.
      pipe('fs-in', 'flue', [{ x: 0, y: 140 }, { x: 20, y: 140 }]),
      ...flow(140, 'flue', [
        { id: 'fs-eco', shape: 'box', label: 'Bộ hâm (khói ra)', tag: 'FG_AH_GAS_IN_TEMP_01', unit: '°C', w: 130, h: 60 },
        { id: 'fs-ah', shape: 'box', label: 'Sấy gió (AH)', tag: 'AH_AIR_OUT_TEMP_01', unit: '°C', w: 130, h: 60 },
        { id: 'fs-id', shape: 'pump', label: 'Quạt khói ID', tag: 'FG_FLOW_01', unit: 't/h', w: 64, h: 64 },
        { id: 'fs-stack', shape: 'stack', label: 'Ống khói', tag: 'FG_STACK_TEMP_01', unit: '°C', w: 70, h: 180, alarms: [{ when: 'gt', value: 150, sev: 3 }] },
      ], 20, 50),
      pipe('fs-up', 'flue', [{ x: 529, y: 50 }, { x: 529, y: 24 }]),
      equip('fs-o2', 'box', 'O₂ khói', 'BLR_FLUE_O2_01', '%', '', 20, 254, 130, 54, [{ when: 'lt', value: 1.5, sev: 2 }]),
      equip('fs-exair', 'box', 'Gió thừa', 'FG_EXCESS_AIR_01', '%', '', 162, 254, 130, 54, [{ when: 'gt', value: 40, sev: 2 }]),
      equip('fs-lambda', 'box', 'Tỷ số gió λ', 'FG_LAMBDA_01', '', '', 304, 254, 130, 54),
      equip('fs-eff', 'box', 'Hiệu suất lò', 'BLR_EFF_01', '%', '', 446, 254, 130, 54, [{ when: 'lt', value: 82, sev: 2 }]),
      equip('fs-dgloss', 'box', 'Tổn thất khói khô', 'FG_DRYGAS_LOSS_01', '%', '', 588, 254, 140, 54),
    ],
  },
  {
    screenId: 'D3-fd-fan',
    level: 'D3',
    title: { vi: 'Quạt gió & gió cháy — bố trí thiết bị', en: 'FD Fan & Combustion Air Layout' },
    elements: [
      // Đường gió cháy: quạt gió FD → sấy gió (AH) → hộp gió (windbox) → buồng lửa. Vị trí van gió/khói +
      // O₂/λ vẽ dưới đường gió.
      pipe('fd-airin', 'air', [{ x: 0, y: 140 }, { x: 20, y: 140 }]),
      ...flow(140, 'air', [
        { id: 'fd-fan', shape: 'pump', label: 'Quạt gió FD', tag: 'PLANT_AIR_FLOW_01', unit: 't/h', w: 64, h: 64 },
        { id: 'fd-ah', shape: 'box', label: 'Sấy gió (AH)', tag: 'AH_AIR_OUT_TEMP_01', unit: '°C', w: 120, h: 60 },
        { id: 'fd-wb', shape: 'box', label: 'Hộp gió (windbox)', tag: 'FG_EXCESS_AIR_01', unit: '%', w: 120, h: 60, alarms: [{ when: 'gt', value: 40, sev: 2 }] },
        { id: 'fd-furn', shape: 'furnace', label: 'Buồng lửa', tag: 'BLR_FURN_PRESS_01', unit: 'Pa', nav: 'D3-furnace', w: 140, h: 150, alarms: [{ when: 'gt', value: 200, sev: 1 }, { when: 'lt', value: -200, sev: 1 }] },
      ], 20, 50),
      equip('fd-fdd', 'box', 'FD damper (OP)', 'BLR_FD_DAMPER_01', '%', '', 20, 254, 150, 54),
      equip('fd-idvane', 'box', 'ID guide vane (OP)', 'BLR_ID_VANE_01', '%', '', 182, 254, 150, 54),
      equip('fd-o2', 'box', 'O₂ khói', 'BLR_FLUE_O2_01', '%', '', 344, 254, 130, 54, [{ when: 'lt', value: 1.5, sev: 2 }]),
      equip('fd-lambda', 'box', 'Tỷ số gió λ', 'FG_LAMBDA_01', '', '', 486, 254, 130, 54),
    ],
  },
  {
    screenId: 'D3-steam-drum',
    level: 'D3',
    title: { vi: 'Bao hơi & cấp nước — bố trí thiết bị', en: 'Steam Drum & Feedwater Layout' },
    elements: [
      // Bao hơi là nút trung tâm: nước cấp (qua van FW) vào; hơi bão hoà ra bộ quá nhiệt; vòng tuần hoàn
      // tự nhiên xuống dàn ống sinh hơi (downcomer) và hơi-nước lên lại (riser).
      pipe('sd-p-fw', 'water', [{ x: 140, y: 95 }, { x: 160, y: 95 }]),
      equip('sd-fw', 'box', 'Nước cấp', 'BLR_FW_FLOW_01', 't/h', '', 20, 67, 120, 56),
      pipe('sd-p-cv', 'water', [{ x: 250, y: 95 }, { x: 270, y: 95 }]),
      equip('sd-fwcv', 'box', 'Van FW (OP)', 'BLR_FW_CV_01', '%', '', 160, 67, 90, 56),
      equip('sd-drum', 'drum', 'Bao hơi', 'BLR_DRUM_LEVEL_01', 'mm', '', 270, 60, 220, 70, [{ when: 'gt', value: 250, sev: 1 }, { when: 'lt', value: -250, sev: 1 }]),
      pipe('sd-p-steam', 'steam', [{ x: 490, y: 95 }, { x: 560, y: 95 }]),
      equip('sd-steam', 'box', 'Hơi ra → SH', 'BLR_STEAM_FLOW_01', 't/h', 'D3-superheater', 560, 67, 150, 56),
      pipe('sd-p-down', 'water', [{ x: 330, y: 130 }, { x: 330, y: 250 }]),
      pipe('sd-p-riser', 'steam', [{ x: 430, y: 250 }, { x: 430, y: 130 }]),
      equip('sd-furn', 'box', 'Dàn ống sinh hơi', 'BLR_FURN_PRESS_01', 'Pa', 'D3-furnace', 300, 250, 160, 60),
      equip('sd-press', 'box', 'Áp hơi chính', 'BLR_MSTM_SH_PRESS_01', 'MPa', '', 20, 250, 140, 54, [{ when: 'lt', value: 16, sev: 2 }]),
      equip('sd-temp', 'box', 'Nhiệt hơi SH', 'BLR_MSTM_SH_TEMP_01', '°C', '', 560, 250, 150, 54, [{ when: 'gt', value: 550, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-boiler-combustion',
    level: 'D3',
    title: { vi: 'Đốt & gió — bố trí thiết bị', en: 'Combustion & Air Layout' },
    elements: [
      // Cụm đốt: than (từ máy nghiền) + gió cháy (từ FD/windbox) gặp nhau tại vòi đốt → ngọn lửa vào buồng
      // lửa; khói nóng bốc lên đường khói. Firing demand điều phối tỷ lệ nhiên liệu–gió.
      pipe('bc-coalp', 'shaft', [{ x: 180, y: 98 }, { x: 300, y: 98 }, { x: 300, y: 120 }]),
      equip('bc-coal', 'box', 'Cấp than', 'BLR_COAL_FLOW_01', 't/h', 'D3-coal-handling', 40, 70, 140, 56),
      pipe('bc-fddp', 'air', [{ x: 180, y: 228 }, { x: 300, y: 228 }, { x: 300, y: 190 }]),
      equip('bc-fdd', 'box', 'FD damper (OP)', 'BLR_FD_DAMPER_01', '%', '', 40, 200, 140, 56),
      equip('bc-burner', 'box', 'Cụm vòi đốt', 'BLR_FIRING_DEMAND', '%', '', 300, 120, 130, 70),
      pipe('bc-flame', 'flue', [{ x: 430, y: 155 }, { x: 480, y: 155 }]),
      equip('bc-furn', 'furnace', 'Buồng lửa', 'BLR_FURN_PRESS_01', 'Pa', 'D3-furnace', 480, 80, 150, 170, [{ when: 'gt', value: 200, sev: 1 }, { when: 'lt', value: -200, sev: 1 }]),
      pipe('bc-flue', 'flue', [{ x: 555, y: 80 }, { x: 555, y: 54 }]),
      equip('bc-o2', 'box', 'O₂ khói', 'BLR_FLUE_O2_01', '%', '', 40, 290, 140, 54, [{ when: 'lt', value: 1.5, sev: 2 }]),
      equip('bc-idvane', 'box', 'ID guide vane (OP)', 'BLR_ID_VANE_01', '%', '', 196, 290, 140, 54),
      equip('bc-mw', 'box', 'Công suất', 'GEN_MW_01', 'MW', '', 352, 290, 140, 54),
    ],
  },
  {
    screenId: 'D3-turbine-generator',
    level: 'D3',
    title: { vi: 'Turbine & Máy phát — chu trình tái nhiệt', en: 'Turbine-Generator Reheat Cycle' },
    elements: [
      // Chu trình tái nhiệt đầy đủ: hơi chính → HP → (tái nhiệt) → IP → LP → bình ngưng; công suất tầng
      // HP+IP+LP cộng lại = công suất trục máy phát. Dải thông số điện + tái nhiệt vẽ phía dưới.
      pipe('tg-steam', 'steam', [{ x: 110, y: 110 }, { x: 120, y: 110 }]),
      equip('tg-msv', 'box', 'Hơi vào TB', 'TRB_STODOLA_FLOW', 't/h', '', 14, 82, 96, 56),
      ...flow(110, 'shaft', [
        { id: 'tg-hp', shape: 'turbine', label: 'HP', tag: 'TRB_HP_MW_01', unit: 'MW', w: 100, h: 74 },
        { id: 'tg-ip', shape: 'turbine', label: 'IP', tag: 'TRB_IP_MW_01', unit: 'MW', w: 100, h: 74 },
        { id: 'tg-lp', shape: 'turbine', label: 'LP', tag: 'TRB_LP_MW_01', unit: 'MW', w: 140, h: 94 },
        { id: 'tg-gen', shape: 'generator', label: 'Máy phát', tag: 'GEN_MW_01', unit: 'MW', nav: 'D3-generator', w: 86, h: 86 },
      ], 120, 40),
      pipe('tg-crh', 'steam', [{ x: 170, y: 147 }, { x: 170, y: 235 }, { x: 250, y: 235 }]),
      equip('tg-reheat', 'box', 'Bộ tái nhiệt', 'TRB_REHEAT_DUTY_01', 'MWth', '', 250, 210, 120, 50),
      pipe('tg-hrh', 'steam', [{ x: 370, y: 235 }, { x: 370, y: 175 }, { x: 310, y: 175 }, { x: 310, y: 147 }]),
      pipe('tg-lpx', 'steam', [{ x: 470, y: 157 }, { x: 470, y: 210 }]),
      equip('tg-cond', 'box', 'Bình ngưng', 'TRB_COND_VACUUM_01', 'kPa', 'D3-condenser-cw', 400, 210, 140, 50, [{ when: 'gt', value: 12, sev: 2 }]),
      equip('tg-freq', 'box', 'Tần số', 'GEN_FREQ_01', 'Hz', '', 14, 300, 130, 54, [{ when: 'gt', value: 50.5, sev: 2 }, { when: 'lt', value: 49.5, sev: 2 }]),
      equip('tg-mvar', 'box', 'Q phản kháng', 'GEN_MVAR_01', 'MVAr', '', 158, 300, 130, 54),
      equip('tg-stator', 'box', 'Nhiệt stator', 'GEN_STATOR_TEMP_01', '°C', '', 302, 300, 130, 54, [{ when: 'gt', value: 120, sev: 2 }]),
      equip('tg-speed', 'box', 'Tốc độ trục', 'TRB_SPEED_01', 'rpm', '', 446, 300, 130, 54, [{ when: 'gt', value: 3120, sev: 1 }]),
      equip('tg-crhp', 'box', 'Áp cold reheat', 'TRB_CRH_PRESS_01', 'MPa', '', 14, 364, 130, 54),
      equip('tg-crht', 'box', 'Nhiệt cold reheat', 'TRB_CRH_TEMP_01', '°C', '', 158, 364, 130, 54),
      equip('tg-hrhp', 'box', 'Áp hot reheat', 'TRB_HRH_PRESS_01', 'MPa', '', 302, 364, 130, 54),
      equip('tg-hrht', 'box', 'Nhiệt hot reheat', 'TRB_HRH_TEMP_01', '°C', '', 446, 364, 130, 54, [{ when: 'lt', value: 500, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-feedwater-heatrate',
    level: 'D3',
    title: { vi: 'Đoàn nước cấp — bố trí thiết bị (chi tiết)', en: 'Feed Water Train Layout (detailed)' },
    elements: [
      // Đoàn gia nhiệt hồi nhiệt ĐẦY ĐỦ: condensate → 4 bình gia nhiệt hạ áp (LP) → bình khử khí →
      // bơm nước cấp (BFP) → 3 bình gia nhiệt cao áp (HP) → vào economizer. Mỗi bình có nhiệt đầu ra
      // sống riêng; hơi trích từ các tầng turbine cấp cho từng bình (đường cam từ trên).
      pipe('fw-in', 'water', [{ x: 0, y: 150 }, { x: 14, y: 150 }]),
      ...flow(150, 'water', [
        { id: 'fw-cond', shape: 'box', label: 'Condensate', tag: 'FW_CONDENSATE_TEMP_01', unit: '°C', w: 96, h: 64 },
        { id: 'fw-lph1', shape: 'box', label: 'GN hạ áp 1', tag: 'FW_LPH1_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-lph2', shape: 'box', label: 'GN hạ áp 2', tag: 'FW_LPH2_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-lph3', shape: 'box', label: 'GN hạ áp 3', tag: 'FW_LPH3_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-lph4', shape: 'box', label: 'GN hạ áp 4', tag: 'FW_LPH4_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-dea', shape: 'drum', label: 'Bình khử khí', tag: 'FW_DEAERATOR_TEMP_01', unit: '°C', w: 104, h: 60 },
        { id: 'fw-bfp', shape: 'pump', label: 'Bơm nước cấp', tag: 'FW_FLOW_01', unit: 't/h', w: 66, h: 66 },
        { id: 'fw-hph1', shape: 'box', label: 'GN cao áp 1', tag: 'FW_HPH1_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-hph2', shape: 'box', label: 'GN cao áp 2', tag: 'FW_HPH2_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-hph3', shape: 'box', label: 'GN cao áp 3', tag: 'FW_HPH3_TEMP_01', unit: '°C', w: 92, h: 64 },
        { id: 'fw-econ', shape: 'box', label: '→ Economizer', tag: 'FW_ECON_INLET_TEMP_01', unit: '°C', nav: 'D3-furnace', w: 120, h: 64, alarms: [{ when: 'lt', value: 200, sev: 3 }] },
      ], 14, 18),
      // Hơi trích từ turbine cấp cho từng bình gia nhiệt + bình khử khí (sơ đồ, không tag riêng).
      pipe('fw-ext1', 'steam', [{ x: 174, y: 90 }, { x: 174, y: 118 }]),
      pipe('fw-ext2', 'steam', [{ x: 284, y: 90 }, { x: 284, y: 118 }]),
      pipe('fw-ext3', 'steam', [{ x: 394, y: 90 }, { x: 394, y: 118 }]),
      pipe('fw-ext4', 'steam', [{ x: 504, y: 90 }, { x: 504, y: 118 }]),
      pipe('fw-ext5', 'steam', [{ x: 620, y: 90 }, { x: 620, y: 120 }]),
      pipe('fw-ext6', 'steam', [{ x: 820, y: 90 }, { x: 820, y: 118 }]),
      pipe('fw-ext7', 'steam', [{ x: 930, y: 90 }, { x: 930, y: 118 }]),
      pipe('fw-ext8', 'steam', [{ x: 1040, y: 90 }, { x: 1040, y: 118 }]),
      equip('fw-regen', 'box', 'Nhiệt hồi nhiệt', 'FW_REGEN_DUTY_01', 'MWth', '', 14, 250, 180, 54),
      equip('fw-hr', 'box', 'Heat rate chu trình', 'PLANT_CYCLE_HR_01', 'kJ/kWh', '', 210, 250, 200, 54, [{ when: 'gt', value: 9500, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-condenser-cw',
    level: 'D3',
    title: { vi: 'Bình ngưng & Nước tuần hoàn — bố trí thiết bị', en: 'Condenser & CW Layout' },
    elements: [
      // Bình ngưng: hơi xả LP ngưng tụ trong vỏ; nước tuần hoàn (CW) chạy qua chùm ống lấy nhiệt thải;
      // nước ngưng rơi xuống hotwell về đoàn nước cấp.
      pipe('cd-steam', 'steam', [{ x: 370, y: 20 }, { x: 370, y: 64 }]),
      equip('cd-cond', 'box', 'Bình ngưng', 'COND_DUTY_01', 'MWth', '', 250, 64, 240, 110),
      pipe('cd-cwinp', 'water', [{ x: 134, y: 119 }, { x: 250, y: 119 }]),
      equip('cd-cwin', 'box', 'CW vào', 'COND_CW_IN_TEMP_01', '°C', '', 30, 91, 104, 56),
      pipe('cd-cwoutp', 'water', [{ x: 490, y: 119 }, { x: 556, y: 119 }]),
      equip('cd-cwout', 'box', 'CW ra', 'COND_CW_OUT_TEMP_01', '°C', 'D3-cooling-tower', 556, 91, 104, 56, [{ when: 'gt', value: 42, sev: 3 }]),
      pipe('cd-out', 'water', [{ x: 370, y: 174 }, { x: 370, y: 224 }]),
      equip('cd-sat', 'box', 'Nhiệt bão hoà', 'COND_SAT_TEMP_01', '°C', '', 30, 250, 130, 54, [{ when: 'gt', value: 45, sev: 2 }]),
      equip('cd-ttd', 'box', 'TTD', 'COND_TTD_01', '°C', '', 172, 250, 110, 54),
      equip('cd-cwflow', 'box', 'Lưu lượng CW', 'COND_CW_FLOW_01', 't/h', '', 294, 250, 140, 54),
      equip('cd-rise', 'box', 'Tăng nhiệt CW', 'COND_CW_RISE_01', '°C', '', 446, 250, 140, 54),
    ],
  },
  {
    screenId: 'D3-fluegas-air',
    level: 'D3',
    title: { vi: 'Sấy gió & Hiệu suất lò — bố trí thiết bị', en: 'Air Heater & Efficiency Layout' },
    elements: [
      // Bộ sấy gió (air heater) trao đổi nhiệt ngược dòng: khói nóng nhả nhiệt (vào trái-trên, ra trái-dưới
      // → ESP) sấy gió cháy (ra phải-trên → windbox). Thu hồi nhiệt này quyết định hiệu suất lò & tổn thất.
      equip('fa-ah', 'box', 'Bộ sấy gió (AH)', 'FG_FLOW_01', 't/h', '', 310, 100, 170, 150),
      pipe('fa-fluep1', 'flue', [{ x: 290, y: 118 }, { x: 310, y: 118 }]),
      equip('fa-fluein', 'box', 'Khói vào AH', 'FG_AH_GAS_IN_TEMP_01', '°C', '', 150, 90, 140, 56),
      pipe('fa-fluep2', 'flue', [{ x: 310, y: 228 }, { x: 290, y: 228 }]),
      equip('fa-flueout', 'box', 'Khói ra → ESP', 'FG_STACK_TEMP_01', '°C', 'D3-flue-stack', 150, 200, 140, 56, [{ when: 'gt', value: 150, sev: 3 }]),
      pipe('fa-airp', 'air', [{ x: 480, y: 118 }, { x: 500, y: 118 }]),
      equip('fa-airout', 'box', 'Gió nóng → windbox', 'AH_AIR_OUT_TEMP_01', '°C', '', 500, 90, 150, 56),
      equip('fa-eff', 'box', 'Hiệu suất lò', 'BLR_EFF_01', '%', '', 500, 200, 150, 56, [{ when: 'lt', value: 82, sev: 2 }]),
      equip('fa-lambda', 'box', 'Tỷ số gió λ', 'FG_LAMBDA_01', '', '', 150, 300, 140, 54),
      equip('fa-dgloss', 'box', 'Tổn thất khói khô', 'FG_DRYGAS_LOSS_01', '%', '', 310, 300, 170, 54),
      equip('fa-exair', 'box', 'Gió thừa', 'FG_EXCESS_AIR_01', '%', '', 500, 300, 150, 54, [{ when: 'gt', value: 40, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-emissions-cems',
    level: 'D3',
    title: { vi: 'Phát thải (CEMS) — bố trí thiết bị', en: 'Emissions (CEMS) Layout' },
    elements: [
      // Xử lý khói cuối nguồn: lọc bụi tĩnh điện (ESP) → khử SO₂ (FGD) → ống khói. Cụm phân tích CEMS đo
      // liên tục bụi/SO₂/NOₓ/CO₂ tại miệng ống khói.
      pipe('em-in', 'flue', [{ x: 10, y: 150 }, { x: 30, y: 150 }]),
      ...flow(150, 'flue', [
        { id: 'em-esp', shape: 'box', label: 'Lọc bụi ESP', tag: 'EMI_ESP_EFF_01', unit: '%', w: 130, h: 70 },
        { id: 'em-fgd', shape: 'box', label: 'Khử SO₂ (FGD)', tag: 'EMI_FGD_EFF_01', unit: '%', w: 130, h: 70 },
        { id: 'em-stack', shape: 'stack', label: 'Ống khói', tag: 'EMI_FG_VOLUME_01', unit: 'Nm³/h', w: 70, h: 180 },
      ], 30, 60),
      pipe('em-up', 'flue', [{ x: 445, y: 60 }, { x: 445, y: 30 }]),
      pipe('em-tap', 'flue', [{ x: 480, y: 150 }, { x: 500, y: 150 }]),
      pipe('em-bus', 'flue', [{ x: 500, y: 67 }, { x: 500, y: 277 }]),
      equip('em-dust', 'box', 'Bụi', 'EMI_DUST_STACK_01', 'mg/Nm³', '', 520, 40, 170, 54, [{ when: 'gt', value: 30, sev: 2 }]),
      equip('em-so2', 'box', 'SO₂', 'EMI_SO2_STACK_01', 'mg/Nm³', '', 520, 110, 170, 54, [{ when: 'gt', value: 200, sev: 2 }]),
      equip('em-nox', 'box', 'NOₓ', 'EMI_NOX_STACK_01', 'mg/Nm³', '', 520, 180, 170, 54, [{ when: 'gt', value: 500, sev: 2 }]),
      equip('em-co2', 'box', 'CO₂', 'EMI_CO2_RATE_01', 't/h', '', 520, 250, 170, 54),
    ],
  },
  {
    screenId: 'D3-electrical',
    level: 'D3',
    title: { vi: 'Điện & Xuất lưới — sơ đồ một sợi', en: 'Electrical Single-Line' },
    elements: [
      // Sơ đồ một sợi phía điện: máy phát 667 MVA/20 kV → MBA tăng áp GSU 20/500 kV → lưới 500 kV. Nhánh
      // tự dùng: trích từ đầu cực máy phát qua MBA tự dùng (UAT) 20/6,6 kV → thanh cái 6,6 kV.
      ...flow(100, 'elec', [
        { id: 'el-gen', shape: 'generator', label: 'Máy phát', tag: 'ELEC_GEN_MVA_01', unit: 'MVA', w: 100, h: 100 },
        { id: 'el-gsu', shape: 'transformer', label: 'GSU 20/500 kV', tag: 'ELEC_GSU_LOADING_01', unit: '%', w: 110, h: 100, alarms: [{ when: 'gt', value: 100, sev: 2 }] },
        { id: 'el-grid', shape: 'box', label: 'Lưới 500 kV', tag: 'ELEC_GRID_MW_01', unit: 'MW', w: 130, h: 56 },
      ], 30, 70),
      pipe('el-netp', 'elec', [{ x: 510, y: 100 }, { x: 560, y: 100 }]),
      equip('el-net', 'box', 'Công suất net', 'ELEC_NET_MW_01', 'MW', '', 560, 72, 150, 56),
      equip('el-cur', 'box', 'Dòng stator', 'ELEC_GEN_CURRENT_01', 'kA', '', 560, 150, 150, 56),
      pipe('el-auxbus', 'elec', [{ x: 80, y: 150 }, { x: 80, y: 300 }, { x: 200, y: 300 }]),
      equip('el-uat', 'transformer', 'UAT 20/6,6 kV', 'ELEC_AUX_LOADING_01', '%', '', 200, 250, 110, 100, [{ when: 'gt', value: 100, sev: 2 }]),
      pipe('el-auxp', 'elec', [{ x: 310, y: 300 }, { x: 380, y: 300 }]),
      equip('el-aux', 'box', 'Tự dùng 6,6 kV', 'ELEC_AUX_POWER_01', 'MW', '', 380, 272, 150, 56),
      equip('el-pf', 'box', 'Hệ số cs (cosφ)', 'ELEC_PF_01', '', '', 560, 272, 150, 56, [{ when: 'lt', value: 0.85, sev: 3 }]),
    ],
  },
  {
    screenId: 'D3-cooling-tower',
    level: 'D3',
    title: { vi: 'Tháp làm mát — bố trí thiết bị', en: 'Cooling Tower Layout' },
    elements: [
      // Vòng nước tuần hoàn khép kín: CW nóng từ bình ngưng lên tháp làm mát (đối lưu tự nhiên) → hơi ẩm
      // bốc lên, nước lạnh rơi xuống bể → bơm CW đẩy về bình ngưng. Bổ sung bù bốc hơi + cuốn theo.
      pipe('ct-vapor', 'air', [{ x: 375, y: 44 }, { x: 375, y: 16 }]),
      equip('ct-tower', 'stack', 'Tháp làm mát', 'CT_HEAT_REJECT_01', 'MWth', '', 300, 44, 150, 190),
      pipe('ct-hotp', 'water', [{ x: 194, y: 98 }, { x: 300, y: 98 }]),
      equip('ct-hot', 'box', 'CW nóng (từ bình ngưng)', 'CT_RANGE_01', '°C', 'D3-condenser-cw', 24, 70, 170, 56),
      pipe('ct-coldp', 'water', [{ x: 375, y: 234 }, { x: 375, y: 300 }, { x: 264, y: 300 }]),
      equip('ct-cwp', 'pump', 'Bơm CW', 'CT_CW_SUPPLY_01', '°C', '', 200, 268, 64, 64),
      pipe('ct-retp', 'water', [{ x: 200, y: 300 }, { x: 80, y: 300 }, { x: 80, y: 126 }]),
      equip('ct-wb', 'box', 'Bầu ướt', 'CT_WETBULB_01', '°C', '', 480, 70, 160, 54),
      equip('ct-approach', 'box', 'Approach', 'CT_APPROACH_01', '°C', '', 480, 150, 160, 54),
      equip('ct-evap', 'box', 'Bốc hơi', 'CT_EVAP_LOSS_01', 't/h', '', 480, 230, 160, 54),
      equip('ct-makeup', 'box', 'Nước bổ sung', 'CT_MAKEUP_01', 't/h', '', 480, 310, 160, 54),
    ],
  },
  {
    screenId: 'D3-coal-handling',
    level: 'D3',
    title: { vi: 'Cung cấp than — bố trí thiết bị (chi tiết)', en: 'Coal Handling Layout (detailed)' },
    elements: [
      // Tuyến than: kho than (yard) → băng tải → bunker gallery; bunker cấp SONG SONG cho 6 máy nghiền
      // A–F (5 chạy + 1 dự phòng), mỗi máy có tải sống riêng → gom về vòi đốt buồng lửa.
      pipe('cl-p1', 'shaft', [{ x: 144, y: 56 }, { x: 170, y: 56 }]),
      equip('cl-yard', 'box', 'Kho than (yard)', 'COAL_YARD_DAYS_01', 'ngày', '', 14, 28, 130, 56, [{ when: 'lt', value: 7, sev: 2 }]),
      pipe('cl-p2', 'shaft', [{ x: 300, y: 56 }, { x: 326, y: 56 }]),
      equip('cl-conv', 'box', 'Băng tải cấp', 'COAL_CONVEYOR_FEED_01', 't/h', '', 170, 28, 130, 56),
      equip('cl-bunker', 'box', 'Bunker', 'COAL_BUNKER_LEVEL_01', '%', '', 326, 28, 150, 56, [{ when: 'lt', value: 30, sev: 2 }]),
      equip('cl-millsrun', 'box', 'Số mill chạy', 'COAL_MILLS_RUNNING_01', '', '', 520, 28, 120, 56),
      equip('cl-feeder', 'box', 'Suất feeder/mill', 'COAL_FEEDER_RATE_01', 't/h', '', 660, 28, 134, 56),
      // Phân phối từ bunker xuống 6 mill.
      pipe('cl-drop', 'shaft', [{ x: 401, y: 84 }, { x: 401, y: 150 }]),
      pipe('cl-header', 'shaft', [{ x: 70, y: 150 }, { x: 670, y: 150 }]),
      pipe('cl-d1', 'shaft', [{ x: 70, y: 150 }, { x: 70, y: 214 }]),
      pipe('cl-d2', 'shaft', [{ x: 190, y: 150 }, { x: 190, y: 214 }]),
      pipe('cl-d3', 'shaft', [{ x: 310, y: 150 }, { x: 310, y: 214 }]),
      pipe('cl-d4', 'shaft', [{ x: 430, y: 150 }, { x: 430, y: 214 }]),
      pipe('cl-d5', 'shaft', [{ x: 550, y: 150 }, { x: 550, y: 214 }]),
      pipe('cl-d6', 'shaft', [{ x: 670, y: 150 }, { x: 670, y: 214 }]),
      equip('cl-mill-a', 'generator', 'Mill A', 'COAL_MILL_A_LOAD_01', '%', '', 34, 214, 72, 72, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('cl-mill-b', 'generator', 'Mill B', 'COAL_MILL_B_LOAD_01', '%', '', 154, 214, 72, 72, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('cl-mill-c', 'generator', 'Mill C', 'COAL_MILL_C_LOAD_01', '%', '', 274, 214, 72, 72, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('cl-mill-d', 'generator', 'Mill D', 'COAL_MILL_D_LOAD_01', '%', '', 394, 214, 72, 72, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('cl-mill-e', 'generator', 'Mill E', 'COAL_MILL_E_LOAD_01', '%', '', 514, 214, 72, 72, [{ when: 'gt', value: 100, sev: 2 }]),
      equip('cl-mill-f', 'generator', 'Mill F (dự phòng)', 'COAL_MILL_F_LOAD_01', '%', '', 634, 214, 72, 72, [{ when: 'gt', value: 100, sev: 2 }]),
      // Gom bột than về vòi đốt buồng lửa.
      pipe('cl-bhdr', 'shaft', [{ x: 70, y: 286 }, { x: 670, y: 286 }]),
      pipe('cl-bdrop', 'shaft', [{ x: 370, y: 286 }, { x: 370, y: 320 }]),
      equip('cl-furn', 'box', '→ Vòi đốt / buồng lửa', 'COAL_CONSUMPTION_01', 't/h', 'D3-furnace', 280, 320, 180, 54),
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
