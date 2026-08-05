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
      equip('sh-ltsh', 'box', 'SH cấp 1 (LTSH)', 'BLR_SH_LTSH_TEMP_01', '°C', '', 30, 190, 92, 54),
      equip('sh-platen', 'box', 'SH bức xạ (platen)', 'BLR_SH_PLATEN_TEMP_01', '°C', '', 128, 190, 96, 54),
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
      equip('rh-bias', 'box', 'Gas-biasing RH (loop)', 'TRB_RH_BIAS_01', '%', '', 590, 150, 140, 54),
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
      equip('tb-brg', 'box', 'Nhiệt gối trục', 'TRB_BRG_TEMP_01', '°C', '', 14, 314, 140, 54, [{ when: 'gt', value: 110, sev: 2 }]),
      equip('tb-vib', 'box', 'Rung trục', 'TRB_VIB_01', 'mm/s', '', 164, 314, 140, 54, [{ when: 'gt', value: 7, sev: 2 }]),
      // Hơi chèn trục (loop gland steam): áp header + độ mở van cấp giữ dương ~5 kPag chống lọt khí.
      equip('tb-gland', 'box', 'Áp hơi chèn', 'TRB_GLAND_PRESS_01', 'kPag', '', 314, 314, 150, 54, [{ when: 'lt', value: 2, sev: 2 }]),
      equip('tb-glandv', 'box', 'Van hơi chèn', 'TRB_GLAND_VALVE_01', '%', '', 474, 314, 150, 54),
      // Dầu bôi trơn gối trục (loop C-5): nhiệt dầu (van CW cooler) + áp header dầu (bơm/van).
      equip('tb-oiltemp', 'box', 'Nhiệt dầu bôi trơn', 'TRB_LUBE_OIL_TEMP_01', '°C', '', 14, 378, 150, 54, [{ when: 'gt', value: 55, sev: 2 }]),
      equip('tb-oilcw', 'box', 'Van CW dầu', 'TRB_OIL_CW_VALVE_01', '%', '', 174, 378, 120, 54),
      equip('tb-oilpress', 'box', 'Áp dầu bôi trơn', 'TRB_LUBE_OIL_PRESS_01', 'MPa', '', 304, 378, 150, 54, [{ when: 'lt', value: 0.12, sev: 1 }]),
      equip('tb-oilpump', 'box', 'Bơm dầu', 'TRB_OIL_PUMP_CMD_01', '%', '', 464, 378, 120, 54),
      // HP turbine bypass (loop): xả hơi SH → cold reheat khi áp vượt ngưỡng (đóng ở tải, mở khi trip).
      equip('tb-hpbp', 'box', 'HP bypass xả', 'BLR_HP_BYPASS_FLOW_01', 't/h', '', 14, 442, 160, 54),
      equip('tb-hpbpo', 'box', 'Van HP bypass', 'BLR_HP_BYPASS_OPEN_01', '%', '', 184, 442, 140, 54),
      // LP turbine bypass (loop): xả hot reheat → bình ngưng khi áp reheat vượt ngưỡng (đóng ở tải, mở khi trip).
      equip('tb-lpbp', 'box', 'LP bypass xả', 'TRB_LP_BYPASS_FLOW_01', 't/h', '', 334, 442, 160, 54),
      equip('tb-lpbpo', 'box', 'Van LP bypass', 'TRB_LP_BYPASS_OPEN_01', '%', '', 504, 442, 140, 54),
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
      // Làm mát máy phát (loop C-4): áp khí H₂ (van cấp) + nhiệt nước làm mát stator (van nước làm mát).
      equip('gn-h2', 'box', 'Áp H₂ (loop)', 'ELEC_H2_PRESS_01', 'MPa', '', 20, 314, 130, 54, [{ when: 'lt', value: 0.3, sev: 2 }]),
      equip('gn-h2v', 'box', 'Van H₂', 'ELEC_H2_VALVE_01', '%', '', 158, 314, 110, 54),
      equip('gn-scw', 'box', 'Nước mát stator (loop)', 'ELEC_STATOR_CW_TEMP_01', '°C', '', 276, 314, 180, 54, [{ when: 'gt', value: 50, sev: 2 }]),
      equip('gn-scwv', 'box', 'Van nước mát', 'ELEC_STATOR_CW_VALVE_01', '%', '', 464, 314, 140, 54),
      // Hoàn thiện hệ H₂ máy phát (loop C-6): nhiệt khí H₂ (van CW cooler) + chênh áp seal oil chống rò H₂.
      equip('gn-h2t', 'box', 'Nhiệt khí H₂ (loop)', 'ELEC_H2_TEMP_01', '°C', '', 20, 378, 150, 54, [{ when: 'gt', value: 46, sev: 2 }]),
      equip('gn-h2cw', 'box', 'Van CW H₂', 'ELEC_H2_CW_VALVE_01', '%', '', 178, 378, 110, 54),
      equip('gn-seal', 'box', 'dP seal oil (loop)', 'ELEC_SEAL_OIL_DP_01', 'MPa', '', 296, 378, 150, 54, [{ when: 'lt', value: 0.04, sev: 2 }]),
      equip('gn-sealv', 'box', 'Van seal oil', 'ELEC_SEAL_OIL_VALVE_01', '%', '', 454, 378, 120, 54),
    ],
  },
  {
    screenId: 'D3-flue-stack',
    level: 'D3',
    title: { vi: 'Đường khói & ống khói — bố trí thiết bị (chi tiết)', en: 'Flue Gas Path Layout (detailed)' },
    elements: [
      // Đường khói: buồng lửa → bộ hâm/economizer → sấy gió (AH) → 2 quạt khói ID (A/B, mỗi quạt 50%)
      // song song → ống khói. Chỉ số cháy (O₂/λ/gió thừa/hiệu suất) vẽ dưới đường khói.
      pipe('fs-in', 'flue', [{ x: 0, y: 140 }, { x: 20, y: 140 }]),
      equip('fs-eco', 'box', 'Bộ hâm (khói ra)', 'FG_AH_GAS_IN_TEMP_01', '°C', '', 20, 110, 130, 60),
      pipe('fs-p1', 'flue', [{ x: 150, y: 140 }, { x: 200, y: 140 }]),
      equip('fs-ah', 'box', 'Sấy gió (AH)', 'AH_AIR_OUT_TEMP_01', '°C', '', 200, 110, 130, 60),
      pipe('fs-ptrunk', 'flue', [{ x: 330, y: 140 }, { x: 360, y: 140 }]),
      pipe('fs-upA', 'flue', [{ x: 360, y: 140 }, { x: 360, y: 122 }, { x: 380, y: 122 }]),
      pipe('fs-dnB', 'flue', [{ x: 360, y: 140 }, { x: 360, y: 202 }, { x: 380, y: 202 }]),
      equip('fs-idA', 'pump', 'Quạt ID A', 'FG_IDA_FLOW_01', 't/h', '', 380, 90, 64, 64),
      equip('fs-idB', 'pump', 'Quạt ID B', 'FG_IDB_FLOW_01', 't/h', '', 380, 170, 64, 64),
      pipe('fs-mA', 'flue', [{ x: 444, y: 122 }, { x: 480, y: 122 }, { x: 480, y: 150 }]),
      pipe('fs-mB', 'flue', [{ x: 444, y: 202 }, { x: 480, y: 202 }, { x: 480, y: 150 }]),
      pipe('fs-tostack', 'flue', [{ x: 480, y: 150 }, { x: 500, y: 150 }]),
      equip('fs-stack', 'stack', 'Ống khói', 'FG_STACK_TEMP_01', '°C', '', 500, 60, 70, 180, [{ when: 'gt', value: 150, sev: 3 }]),
      pipe('fs-up', 'flue', [{ x: 535, y: 60 }, { x: 535, y: 32 }]),
      equip('fs-o2', 'box', 'O₂ khói', 'BLR_FLUE_O2_01', '%', '', 20, 280, 130, 54, [{ when: 'lt', value: 1.5, sev: 2 }]),
      equip('fs-exair', 'box', 'Gió thừa', 'FG_EXCESS_AIR_01', '%', '', 162, 280, 130, 54, [{ when: 'gt', value: 40, sev: 2 }]),
      equip('fs-lambda', 'box', 'Tỷ số gió λ', 'FG_LAMBDA_01', '', '', 304, 280, 130, 54),
      equip('fs-eff', 'box', 'Hiệu suất lò', 'BLR_EFF_01', '%', '', 446, 280, 130, 54, [{ when: 'lt', value: 82, sev: 2 }]),
      equip('fs-dgloss', 'box', 'Tổn thất khói khô', 'FG_DRYGAS_LOSS_01', '%', '', 588, 280, 140, 54),
    ],
  },
  {
    screenId: 'D3-fd-fan',
    level: 'D3',
    title: { vi: 'Quạt gió & gió cháy — bố trí thiết bị (chi tiết)', en: 'FD Fan & Combustion Air Layout (detailed)' },
    elements: [
      // Đường gió cháy: 2 quạt gió FD (A/B, mỗi quạt 50%) song song → gộp → sấy gió (AH) → hộp gió
      // (windbox) → buồng lửa. Van gió/khói + O₂/λ vẽ dưới đường gió.
      pipe('fd-inA', 'air', [{ x: 0, y: 122 }, { x: 20, y: 122 }]),
      pipe('fd-inB', 'air', [{ x: 0, y: 202 }, { x: 20, y: 202 }]),
      equip('fd-fanA', 'pump', 'Quạt FD A', 'FG_FDA_FLOW_01', 't/h', '', 20, 90, 64, 64),
      equip('fd-fanB', 'pump', 'Quạt FD B', 'FG_FDB_FLOW_01', 't/h', '', 20, 170, 64, 64),
      pipe('fd-mA', 'air', [{ x: 84, y: 122 }, { x: 120, y: 122 }, { x: 120, y: 160 }]),
      pipe('fd-mB', 'air', [{ x: 84, y: 202 }, { x: 120, y: 202 }, { x: 120, y: 160 }]),
      pipe('fd-toah', 'air', [{ x: 120, y: 160 }, { x: 160, y: 160 }]),
      equip('fd-ah', 'box', 'Sấy gió (AH)', 'AH_AIR_OUT_TEMP_01', '°C', '', 160, 130, 120, 60),
      pipe('fd-ahwb', 'air', [{ x: 280, y: 160 }, { x: 320, y: 160 }]),
      equip('fd-wb', 'box', 'Hộp gió (windbox)', 'FG_EXCESS_AIR_01', '%', '', 320, 130, 120, 60, [{ when: 'gt', value: 40, sev: 2 }]),
      pipe('fd-wbfurn', 'air', [{ x: 440, y: 160 }, { x: 480, y: 160 }]),
      equip('fd-furn', 'furnace', 'Buồng lửa', 'BLR_FURN_PRESS_01', 'Pa', 'D3-furnace', 480, 90, 140, 150, [{ when: 'gt', value: 200, sev: 1 }, { when: 'lt', value: -200, sev: 1 }]),
      equip('fd-fdd', 'box', 'FD damper (OP)', 'BLR_FD_DAMPER_01', '%', '', 20, 280, 150, 54),
      equip('fd-idvane', 'box', 'ID guide vane (OP)', 'BLR_ID_VANE_01', '%', '', 182, 280, 150, 54),
      equip('fd-o2', 'box', 'O₂ khói', 'BLR_FLUE_O2_01', '%', '', 344, 280, 130, 54, [{ when: 'lt', value: 1.5, sev: 2 }]),
      equip('fd-lambda', 'box', 'Tỷ số gió λ', 'FG_LAMBDA_01', '', '', 486, 280, 130, 54),
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
      equip('fw-dealvl', 'box', 'Mức khử khí (loop)', 'FW_DEAERATOR_LEVEL_01', '%', '', 424, 250, 170, 54, [{ when: 'gt', value: 80, sev: 2 }, { when: 'lt', value: 20, sev: 2 }]),
      equip('fw-recirc', 'box', 'BFP recirc (loop)', 'BLR_BFP_RECIRC_01', '%', '', 604, 250, 150, 54),
      // Áp bình khử khí (loop pegging steam): áp + độ mở van pegging bù hơi trích non tải.
      equip('fw-deapress', 'box', 'Áp khử khí (loop)', 'FW_DEA_PRESS_01', 'MPa', '', 424, 310, 170, 54, [{ when: 'lt', value: 0.6, sev: 2 }]),
      equip('fw-peg', 'box', 'Van pegging (loop)', 'FW_DEA_PEG_VALVE_01', '%', '', 604, 310, 150, 54),
      // Header hơi phụ trợ (loop C-5, PRDS): cấp hơi cho pegging deaerator / thổi bụi / phun sương dầu.
      equip('fw-auxpress', 'box', 'Áp hơi phụ trợ (loop)', 'FW_AUX_STEAM_PRESS_01', 'MPa', '', 424, 370, 170, 54, [{ when: 'lt', value: 0.9, sev: 2 }]),
      equip('fw-prds', 'box', 'Van PRDS (loop)', 'FW_AUX_PRDS_VALVE_01', '%', '', 604, 370, 150, 54),
    ],
  },
  {
    screenId: 'D3-condenser-cw',
    level: 'D3',
    title: { vi: 'Bình ngưng & Nước tuần hoàn — bố trí thiết bị (chi tiết)', en: 'Condenser & CW Layout (detailed)' },
    elements: [
      // Bình ngưng: hơi xả LP ngưng tụ trong vỏ; 2 bơm nước tuần hoàn (A/B, mỗi bơm 50%) đẩy CW qua chùm
      // ống lấy nhiệt thải → về tháp làm mát; nước ngưng rơi xuống hotwell về đoàn nước cấp.
      pipe('cd-steam', 'steam', [{ x: 370, y: 14 }, { x: 370, y: 54 }]),
      equip('cd-cond', 'box', 'Bình ngưng', 'COND_DUTY_01', 'MWth', '', 250, 54, 240, 110),
      equip('cd-cwin', 'box', 'CW vào', 'COND_CW_IN_TEMP_01', '°C', '', 30, 81, 104, 56),
      pipe('cd-cwinp', 'water', [{ x: 134, y: 109 }, { x: 250, y: 109 }]),
      pipe('cd-cwoutp', 'water', [{ x: 490, y: 109 }, { x: 556, y: 109 }]),
      equip('cd-cwout', 'box', 'CW ra → tháp', 'COND_CW_OUT_TEMP_01', '°C', 'D3-cooling-tower', 556, 81, 104, 56, [{ when: 'gt', value: 42, sev: 3 }]),
      pipe('cd-out', 'water', [{ x: 370, y: 164 }, { x: 370, y: 210 }]),
      // 2 bơm CW cấp vào bình ngưng (từ tháp làm mát).
      equip('cd-cwpA', 'pump', 'Bơm CW A', 'COND_CWP_A_FLOW_01', 't/h', '', 20, 220, 64, 64),
      equip('cd-cwpB', 'pump', 'Bơm CW B', 'COND_CWP_B_FLOW_01', 't/h', '', 100, 220, 64, 64),
      pipe('cd-pA', 'water', [{ x: 52, y: 220 }, { x: 52, y: 180 }, { x: 82, y: 180 }, { x: 82, y: 137 }]),
      pipe('cd-pB', 'water', [{ x: 132, y: 220 }, { x: 132, y: 180 }, { x: 82, y: 180 }]),
      equip('cd-hotwell', 'box', 'Mức hotwell (loop)', 'COND_HOTWELL_LEVEL_01', '%', '', 305, 182, 150, 48, [{ when: 'gt', value: 80, sev: 2 }, { when: 'lt', value: 20, sev: 2 }]),
      equip('cd-sat', 'box', 'Nhiệt bão hoà', 'COND_SAT_TEMP_01', '°C', '', 250, 250, 130, 54, [{ when: 'gt', value: 45, sev: 2 }]),
      equip('cd-ttd', 'box', 'TTD', 'COND_TTD_01', '°C', '', 392, 250, 100, 54),
      equip('cd-cwflow', 'box', 'Tổng CW', 'COND_CW_FLOW_01', 't/h', '', 504, 250, 120, 54),
      equip('cd-rise', 'box', 'Tăng nhiệt CW', 'COND_CW_RISE_01', '°C', '', 636, 250, 130, 54),
      // Nước làm mát khép kín phụ trợ CCW (loop C-6): nhiệt CCW + van CW bộ trao đổi thải nhiệt phụ trợ.
      equip('cd-ccw', 'box', 'Nhiệt CCW (loop)', 'COND_CCW_TEMP_01', '°C', '', 250, 314, 160, 54, [{ when: 'gt', value: 44, sev: 2 }]),
      equip('cd-ccwv', 'box', 'Van CW→CCW', 'COND_CCW_CW_VALVE_01', '%', '', 420, 314, 140, 54),
      // Hút khí bình ngưng (loop SJAE): O₂ hoà tan + độ mở van hút khí không ngưng.
      equip('cd-o2', 'box', 'O₂ hoà tan (loop SJAE)', 'COND_O2_01', 'ppb', '', 250, 378, 160, 54, [{ when: 'gt', value: 15, sev: 2 }]),
      equip('cd-sjae', 'box', 'Van hút khí SJAE', 'COND_SJAE_VALVE_01', '%', '', 420, 378, 140, 54),
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
    title: { vi: 'Phát thải (CEMS) — bố trí thiết bị (chi tiết)', en: 'Emissions (CEMS) Layout (detailed)' },
    elements: [
      // Xử lý khói cuối nguồn: lọc bụi tĩnh điện ESP 4 TRƯỜNG nối tiếp (bụi giảm dần) → khử SO₂ (FGD) →
      // ống khói. Cụm phân tích CEMS đo liên tục bụi/SO₂/NOₓ/CO₂ tại miệng ống khói.
      pipe('em-in', 'flue', [{ x: 0, y: 110 }, { x: 14, y: 110 }]),
      ...flow(110, 'flue', [
        { id: 'em-espin', shape: 'box', label: 'Bụi vào ESP', tag: 'EMI_ESP_IN_DUST_01', unit: 'mg/Nm³', w: 96, h: 64 },
        { id: 'em-f1', shape: 'box', label: 'ESP trường 1', tag: 'EMI_ESP_F1_DUST_01', unit: 'mg/Nm³', w: 96, h: 64 },
        { id: 'em-f2', shape: 'box', label: 'ESP trường 2', tag: 'EMI_ESP_F2_DUST_01', unit: 'mg/Nm³', w: 96, h: 64 },
        { id: 'em-f3', shape: 'box', label: 'ESP trường 3', tag: 'EMI_ESP_F3_DUST_01', unit: 'mg/Nm³', w: 96, h: 64 },
        { id: 'em-f4', shape: 'box', label: 'ESP trường 4', tag: 'EMI_ESP_F4_DUST_01', unit: 'mg/Nm³', w: 96, h: 64, alarms: [{ when: 'gt', value: 30, sev: 2 }] },
        { id: 'em-fgd', shape: 'box', label: 'FGD (khử SO₂)', tag: 'EMI_FGD_EFF_01', unit: '%', w: 110, h: 64 },
      ], 14, 16),
      // Ống khói tách khỏi chuỗi flow, giãn thêm (gap ~40) để số thể tích 7 chữ số không đè hộp FGD.
      pipe('em-stack-in', 'flue', [{ x: 684, y: 110 }, { x: 724, y: 110 }]),
      equip('em-stack', 'stack', 'Ống khói', 'EMI_FG_VOLUME_01', 'Nm³/h', '', 724, 35, 64, 150),
      pipe('em-up', 'flue', [{ x: 756, y: 35 }, { x: 756, y: 12 }]),
      equip('em-so2', 'box', 'SO₂ ra ống khói', 'EMI_SO2_STACK_01', 'mg/Nm³', '', 14, 230, 140, 54, [{ when: 'gt', value: 200, sev: 2 }]),
      equip('em-nox', 'box', 'NOₓ ra ống khói', 'EMI_NOX_STACK_01', 'mg/Nm³', '', 166, 230, 140, 54, [{ when: 'gt', value: 500, sev: 2 }]),
      equip('em-co2', 'box', 'CO₂', 'EMI_CO2_RATE_01', 't/h', '', 318, 230, 140, 54),
      equip('em-espeff', 'box', 'Hiệu suất ESP', 'EMI_ESP_EFF_01', '%', '', 470, 230, 140, 54),
      equip('em-dust', 'box', 'Bụi ra ống khói', 'EMI_DUST_STACK_01', 'mg/Nm³', '', 622, 230, 150, 54, [{ when: 'gt', value: 30, sev: 2 }]),
      // Điều khiển môi trường (CCS): SCR deNOx (NH₃) hạ NOₓ vào→ra; FGD deSO₂ (slurry) giữ hiệu suất khử.
      equip('em-scrin', 'box', 'NOₓ vào SCR', 'EMI_NOX_SCR_IN_01', 'mg/Nm³', '', 14, 300, 140, 54),
      equip('em-screff', 'box', 'Hiệu suất SCR', 'EMI_SCR_EFF_01', '%', '', 166, 300, 140, 54),
      equip('em-nh3', 'box', 'NH₃ phun (SCR)', 'EMI_NH3_INJ_01', '%', '', 318, 300, 140, 54),
      equip('em-slurry', 'box', 'Slurry FGD', 'EMI_FGD_SLURRY_01', '%', '', 470, 300, 140, 54),
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
      pipe('el-netp', 'elec', [{ x: 510, y: 100 }, { x: 570, y: 100 }]),
      equip('el-net', 'box', 'Công suất net', 'ELEC_NET_MW_01', 'MW', '', 570, 72, 150, 56),
      equip('el-cur', 'box', 'Dòng stator', 'ELEC_GEN_CURRENT_01', 'kA', '', 570, 150, 150, 56),
      equip('el-breaker', 'box', 'Máy cắt MF (1=đóng)', 'ELEC_BREAKER_01', '', '', 110, 162, 150, 48, [{ when: 'lt', value: 1, sev: 1 }]),
      // Nhánh tự dùng: đầu cực máy phát → UAT 20/6,6 kV → 2 phân đoạn thanh cái 6,6 kV (A/B).
      pipe('el-auxbus', 'elec', [{ x: 80, y: 150 }, { x: 80, y: 300 }, { x: 200, y: 300 }]),
      equip('el-uat', 'transformer', 'UAT 20/6,6 kV', 'ELEC_AUX_LOADING_01', '%', '', 200, 250, 110, 100, [{ when: 'gt', value: 100, sev: 2 }]),
      pipe('el-auxp', 'elec', [{ x: 310, y: 300 }, { x: 350, y: 300 }]),
      pipe('el-toA', 'elec', [{ x: 350, y: 300 }, { x: 350, y: 271 }, { x: 380, y: 271 }]),
      pipe('el-toB', 'elec', [{ x: 350, y: 300 }, { x: 350, y: 337 }, { x: 380, y: 337 }]),
      equip('el-boardA', 'box', 'Thanh cái 6,6 kV A', 'ELEC_AUX_A_MW_01', 'MW', '', 380, 244, 160, 54),
      equip('el-boardB', 'box', 'Thanh cái 6,6 kV B', 'ELEC_AUX_B_MW_01', 'MW', '', 380, 310, 160, 54),
      equip('el-auxtot', 'box', 'Tổng tự dùng', 'ELEC_AUX_POWER_01', 'MW', '', 570, 228, 150, 56),
      equip('el-pf', 'box', 'Hệ số cs (cosφ)', 'ELEC_PF_01', '', '', 570, 306, 150, 56, [{ when: 'lt', value: 0.85, sev: 3 }]),
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
      equip('ct-cwhot', 'box', 'CW nóng (spray)', 'CT_CW_HOT_01', '°C', '', 24, 140, 150, 48),
      equip('ct-fillmid', 'box', 'Giữa lớp fill', 'CT_FILL_MID_01', '°C', '', 24, 200, 150, 48),
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
      // Hệ gió sơ cấp/sấy mill (loop C-3): nhiệt ra mill (van gió nóng) + áp header PA (van quạt PA).
      equip('cl-milltemp', 'box', 'Nhiệt ra mill (loop)', 'COAL_MILL_OUT_TEMP_01', '°C', '', 14, 320, 126, 54, [{ when: 'gt', value: 90, sev: 2 }]),
      equip('cl-hotdmp', 'box', 'Van gió nóng', 'COAL_HOT_AIR_DMPR_01', '%', '', 148, 320, 120, 54),
      equip('cl-paheader', 'box', 'Áp header PA (loop)', 'COAL_PA_HEADER_PRESS_01', 'kPa', '', 480, 320, 140, 54, [{ when: 'lt', value: 5, sev: 2 }]),
      equip('cl-pavane', 'box', 'Van quạt PA', 'COAL_PA_FAN_VANE_01', '%', '', 628, 320, 130, 54),
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
  {
    screenId: 'D3-compressed-air',
    level: 'D3',
    title: { vi: 'Khí nén & Khí điều khiển — bố trí thiết bị', en: 'Compressed & Instrument Air Layout' },
    elements: [
      // 2 máy nén → bình chứa → sấy khí điều khiển → header khí điều khiển (IA) + khí dịch vụ (SA).
      equip('ca-compA', 'pump', 'Máy nén A', 'CA_COMP_A_LOAD_01', '%', '', 20, 60, 90, 80),
      equip('ca-compB', 'pump', 'Máy nén B', 'CA_COMP_B_LOAD_01', '%', '', 20, 170, 90, 80),
      pipe('ca-pa', 'air', [{ x: 110, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 130 }]),
      pipe('ca-pb', 'air', [{ x: 110, y: 210 }, { x: 200, y: 210 }, { x: 200, y: 170 }]),
      equip('ca-recv', 'drum', 'Bình chứa', 'CA_RECEIVER_PRESS_01', 'barg', '', 200, 100, 130, 100, [{ when: 'lt', value: 6, sev: 2 }]),
      pipe('ca-pd', 'air', [{ x: 330, y: 102 }, { x: 400, y: 102 }]),
      equip('ca-dryer', 'box', 'Sấy khí điều khiển', 'CA_IA_DEWPOINT_01', '°C', '', 400, 70, 140, 64, [{ when: 'gt', value: -20, sev: 2 }]),
      pipe('ca-pi', 'air', [{ x: 540, y: 102 }, { x: 620, y: 102 }]),
      equip('ca-ia', 'box', 'Header khí điều khiển', 'CA_IA_HEADER_PRESS_01', 'barg', '', 620, 70, 180, 64, [{ when: 'lt', value: 5.5, sev: 1 }]),
      pipe('ca-ps', 'air', [{ x: 265, y: 200 }, { x: 265, y: 202 }, { x: 400, y: 202 }]),
      equip('ca-sa', 'box', 'Header khí dịch vụ', 'CA_SA_HEADER_PRESS_01', 'barg', '', 400, 170, 180, 64),
      equip('ca-run', 'box', 'Số máy nén chạy', 'CA_COMP_RUNNING_01', '', '', 620, 170, 160, 64),
      equip('ca-dem', 'box', 'Nhu cầu khí', 'CA_DEMAND_01', 'Nm³/min', '', 140, 270, 160, 54),
    ],
  },
  {
    screenId: 'D3-fuel-oil',
    level: 'D3',
    title: { vi: 'Dầu đốt khởi động & đỡ tải — bố trí thiết bị', en: 'Startup Fuel Oil Layout' },
    elements: [
      // Bồn HFO/LDO → hâm HFO (độ nhớt phun) → bơm → header cấp → vòi đốt (chỉ khi khởi động/đỡ lửa).
      equip('fo-hfotank', 'box', 'Bồn HFO', 'FO_HFO_TANK_LEVEL_01', '%', '', 20, 60, 140, 90, [{ when: 'lt', value: 15, sev: 2 }]),
      equip('fo-ldotank', 'box', 'Bồn LDO (mồi)', 'FO_LDO_TANK_LEVEL_01', '%', '', 20, 180, 140, 90, [{ when: 'lt', value: 15, sev: 2 }]),
      pipe('fo-p1', 'water', [{ x: 160, y: 105 }, { x: 200, y: 105 }]),
      equip('fo-heater', 'box', 'Hâm HFO', 'FO_HFO_TEMP_01', '°C', '', 200, 70, 140, 70, [{ when: 'lt', value: 100, sev: 2 }]),
      equip('fo-pump', 'pump', 'Bơm dầu', 'FO_PUMP_RUNNING_01', '', '', 220, 180, 80, 80),
      pipe('fo-p2', 'water', [{ x: 340, y: 105 }, { x: 400, y: 105 }]),
      equip('fo-supply', 'box', 'Áp cấp dầu', 'FO_SUPPLY_PRESS_01', 'barg', '', 400, 70, 160, 64),
      equip('fo-flow', 'box', 'Lưu lượng dầu → vòi đốt', 'FO_FLOW_01', 't/h', 'D3-furnace', 400, 170, 220, 64),
    ],
  },
  {
    screenId: 'D3-ash-handling',
    level: 'D3',
    title: { vi: 'Thải tro — bố trí thiết bị (tro đáy + tro bay)', en: 'Ash Handling Layout' },
    elements: [
      // Tro đáy: buồng lửa → phễu SSC. Tro bay: phễu ESP theo trường → silo → xe bồn.
      equip('ash-furn', 'box', 'Buồng lửa (tổng tro)', 'ASH_TOTAL_01', 't/h', 'D3-furnace', 20, 40, 160, 60),
      equip('ash-bottom', 'box', 'Tro đáy (SSC)', 'ASH_BOTTOM_FLOW_01', 't/h', '', 20, 140, 160, 60),
      equip('ash-bahop', 'box', 'Phễu tro đáy', 'ASH_BA_HOPPER_LEVEL_01', '%', '', 20, 230, 160, 54),
      equip('ash-espA', 'box', 'Phễu ESP A', 'ASH_ESP_HOP_A_01', '%', '', 230, 40, 130, 56),
      equip('ash-espB', 'box', 'Phễu ESP B', 'ASH_ESP_HOP_B_01', '%', '', 230, 112, 130, 56),
      equip('ash-espC', 'box', 'Phễu ESP C', 'ASH_ESP_HOP_C_01', '%', '', 230, 184, 130, 56),
      pipe('ash-pf', 'flue', [{ x: 360, y: 96 }, { x: 400, y: 96 }, { x: 400, y: 100 }]),
      equip('ash-fly', 'box', 'Tro bay', 'ASH_FLY_FLOW_01', 't/h', '', 400, 70, 140, 60),
      pipe('ash-ps', 'flue', [{ x: 540, y: 100 }, { x: 580, y: 100 }, { x: 580, y: 110 }]),
      equip('ash-silo', 'drum', 'Silo tro bay', 'ASH_SILO_LEVEL_01', '%', '', 580, 60, 150, 110, [{ when: 'gt', value: 95, sev: 2 }]),
      equip('ash-unload', 'box', 'Xả xe bồn', 'ASH_UNLOAD_RATE_01', 't/h', '', 580, 200, 150, 54),
    ],
  },
  {
    screenId: 'D3-soot-blower',
    level: 'D3',
    title: { vi: 'Thổi bụi bề mặt truyền nhiệt — trạng thái chu trình', en: 'Heat-transfer Soot Blowing Layout' },
    elements: [
      // Cột trái: header hơi thổi → lưu lượng hơi thổi → trạng thái chu trình.
      equip('sb-header', 'box', 'Header hơi thổi', 'SB_STEAM_HEADER_PRESS_01', 'barg', '', 20, 40, 160, 60, [{ when: 'lt', value: 20, sev: 2 }]),
      equip('sb-steam', 'box', 'Lưu lượng hơi thổi', 'SB_STEAM_FLOW_01', 't/h', '', 20, 130, 160, 60),
      equip('sb-cycle', 'box', 'Chu trình thổi (0/1)', 'SB_CYCLE_ACTIVE_01', '', '', 20, 220, 160, 54),
      // Cột giữa: chỉ số bám (mức) + độ sạch hiệu dụng.
      pipe('sb-p1', 'steam', [{ x: 180, y: 70 }, { x: 240, y: 70 }, { x: 240, y: 95 }]),
      equip('sb-foul', 'drum', 'Chỉ số bám', 'SB_FOULING_INDEX_01', '%', '', 240, 40, 170, 110, [{ when: 'gt', value: 50, sev: 2 }]),
      equip('sb-clean', 'box', 'Độ sạch hiệu dụng', 'SB_CLEANLINESS_01', '%', '', 240, 180, 170, 60, [{ when: 'lt', value: 55, sev: 2 }]),
      // Cột phải: vùng đang thổi → máy thổi đã stroke → thời gian từ chu trình.
      pipe('sb-p2', 'steam', [{ x: 410, y: 95 }, { x: 450, y: 95 }, { x: 450, y: 70 }]),
      equip('sb-zone', 'box', 'Vùng đang thổi (0–4)', 'SB_ZONE_ACTIVE_01', '', '', 450, 40, 200, 60),
      equip('sb-stroked', 'box', 'Máy thổi đã stroke', 'SB_BLOWERS_STROKED_01', '', '', 450, 130, 200, 60),
      equip('sb-since', 'box', 'Từ chu trình gần nhất', 'SB_TIME_SINCE_CYCLE_01', 'phút', '', 450, 220, 200, 54),
      // Ước lượng ảnh hưởng tới đường khói (read-only) → drill sang màn buồng lửa/đốt.
      equip('sb-gasdt', 'box', 'ΔT khói ra (ước lượng)', 'SB_GAS_EXIT_TEMP_DELTA_01', '°C', 'D3-boiler-combustion', 680, 40, 200, 60, [{ when: 'gt', value: 40, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-water-treatment',
    level: 'D3',
    title: { vi: 'Xử lý nước khử khoáng (DM) — bố trí thiết bị', en: 'Demineralization (DM) Water Treatment Layout' },
    elements: [
      // Dây chuyền: cation → khử khí → anion → mixed bed → bồn DM → bơm bù chu trình. Chất lượng = độ dẫn/silica.
      equip('wt-cation', 'box', 'Cột cation (ΔP)', 'WT_CATION_DP_01', 'kPa', '', 20, 40, 160, 56),
      equip('wt-resin', 'box', 'Tải nhựa service', 'WT_RESIN_LOADING_01', '%', '', 20, 112, 160, 56, [{ when: 'gt', value: 90, sev: 2 }]),
      equip('wt-mixbed', 'box', 'Mixed bed (độ dẫn)', 'WT_PRODUCT_COND_01', 'µS/cm', '', 20, 184, 160, 56, [{ when: 'gt', value: 0.2, sev: 2 }]),
      equip('wt-silica', 'box', 'Silica nước DM', 'WT_SILICA_01', 'ppb', '', 20, 256, 160, 56, [{ when: 'gt', value: 20, sev: 2 }]),
      pipe('wt-p1', 'water', [{ x: 180, y: 68 }, { x: 230, y: 68 }, { x: 230, y: 90 }]),
      equip('wt-tank', 'drum', 'Bồn nước DM', 'WT_DM_TANK_LEVEL_01', '%', '', 230, 40, 170, 110, [{ when: 'lt', value: 20, sev: 2 }]),
      pipe('wt-p2', 'water', [{ x: 400, y: 95 }, { x: 440, y: 95 }, { x: 440, y: 200 }]),
      equip('wt-prod', 'box', 'Sản lượng DM', 'WT_DM_PRODUCTION_01', 't/h', '', 230, 170, 170, 56),
      equip('wt-makeup', 'box', 'Nước bù chu trình', 'WT_MAKEUP_FLOW_01', 't/h', 'D3-feedwater-heatrate', 230, 242, 170, 56),
      equip('wt-trains', 'box', 'Dây chuyền service', 'WT_TRAINS_INSERVICE_01', '', '', 440, 40, 200, 56),
      equip('wt-regen', 'box', 'Đang tái sinh (0/1)', 'WT_REGEN_ACTIVE_01', '', '', 440, 112, 200, 56),
    ],
  },
  {
    screenId: 'D3-emergency-power',
    level: 'D3',
    title: { vi: 'Nguồn điện khẩn cấp — Diesel + UPS/Ắc-quy DC', en: 'Emergency Power — Diesel + UPS/Battery Layout' },
    elements: [
      // Diesel khẩn cấp (dừng-sẵn sàng) + UPS/ắc-quy DC 220/110 V (nạp nổi).
      equip('edg-run', 'pump', 'Diesel chạy (0/1)', 'EDG_RUNNING_01', '', '', 20, 40, 170, 56),
      equip('edg-load', 'box', 'Tải EDG', 'EDG_LOAD_01', '%', '', 20, 112, 170, 56),
      equip('edg-fuel', 'box', 'Dầu bồn ngày', 'EDG_FUEL_TANK_01', '%', '', 20, 184, 170, 56, [{ when: 'lt', value: 15, sev: 2 }]),
      equip('edg-ready', 'box', 'EDG sẵn sàng', 'EDG_READY_01', '', '', 20, 256, 170, 56),
      equip('edg-air', 'box', 'Khí khởi động', 'EDG_START_AIR_01', 'barg', '', 20, 328, 170, 56),
      equip('ups-onbatt', 'box', 'UPS chạy ắc-quy', 'UPS_ON_BATTERY_01', '', '', 230, 40, 190, 56),
      equip('ups-soc', 'drum', 'SOC ắc-quy', 'UPS_BATT_SOC_01', '%', '', 230, 112, 190, 90, [{ when: 'lt', value: 30, sev: 2 }]),
      equip('ups-dc220', 'box', 'Thanh cái DC 220 V', 'UPS_DC220_VOLT_01', 'V', '', 230, 222, 190, 56),
      equip('ups-dc110', 'box', 'Thanh cái DC 110 V', 'UPS_DC110_VOLT_01', 'V', '', 230, 294, 190, 56),
      equip('ups-ac', 'box', 'UPS AC ra', 'UPS_AC_OUT_01', 'V', '', 450, 40, 190, 56),
      equip('ups-load', 'box', 'Tải UPS', 'UPS_LOAD_01', '%', '', 450, 112, 190, 56),
    ],
  },
  {
    screenId: 'D3-switchyard',
    level: 'D3',
    title: { vi: 'Trạm phân phối 500 kV — bố trí thiết bị', en: '500 kV Switchyard Layout' },
    elements: [
      // Máy phát → GSU → thanh cái 500 kV → 2 đường dây ra lưới.
      equip('sy-gsu', 'box', 'Qua GSU ra trạm', 'SY_GSU_MW_01', 'MW', 'D3-generator', 20, 40, 180, 56),
      equip('sy-busa', 'box', 'Thanh cái A', 'SY_BUS_A_KV_01', 'kV', '', 20, 112, 180, 56),
      equip('sy-busb', 'box', 'Thanh cái B', 'SY_BUS_B_KV_01', 'kV', '', 20, 184, 180, 56),
      equip('sy-freq', 'box', 'Tần số lưới', 'SY_FREQ_01', 'Hz', '', 20, 256, 180, 56, [{ when: 'lt', value: 49.5, sev: 2 }]),
      pipe('sy-p1', 'elec', [{ x: 200, y: 68 }, { x: 240, y: 68 }, { x: 240, y: 68 }]),
      equip('sy-brk', 'box', 'Máy cắt tổng', 'SY_MAIN_BREAKER_01', '', '', 240, 40, 190, 56),
      equip('sy-lines', 'box', 'Đường dây vận hành', 'SY_LINES_INSERVICE_01', '', '', 240, 112, 190, 56),
      equip('sy-l1mw', 'box', 'Đường dây 1', 'SY_LINE1_MW_01', 'MW', '', 240, 184, 190, 56),
      equip('sy-l2mw', 'box', 'Đường dây 2', 'SY_LINE2_MW_01', 'MW', '', 240, 256, 190, 56),
      equip('sy-l1a', 'box', 'Dòng đường dây 1', 'SY_LINE1_CURRENT_01', 'A', '', 460, 40, 190, 56),
      equip('sy-l2a', 'box', 'Dòng đường dây 2', 'SY_LINE2_CURRENT_01', 'A', '', 460, 112, 190, 56),
    ],
  },
  {
    screenId: 'D3-hvac',
    level: 'D3',
    title: { vi: 'Điều hoà & thông gió (HVAC) — bố trí thiết bị', en: 'HVAC Layout' },
    elements: [
      equip('hv-crt', 'box', 'Nhiệt phòng điều khiển', 'HVAC_CR_TEMP_01', '°C', '', 20, 40, 190, 56, [{ when: 'gt', value: 28, sev: 2 }]),
      equip('hv-crh', 'box', 'Ẩm phòng điều khiển', 'HVAC_CR_HUMID_01', '%', '', 20, 112, 190, 56),
      equip('hv-swgr', 'box', 'Nhiệt phòng tủ điện', 'HVAC_SWGR_TEMP_01', '°C', '', 20, 184, 190, 56, [{ when: 'gt', value: 38, sev: 2 }]),
      equip('hv-chw', 'box', 'Nước lạnh cấp', 'HVAC_CHW_SUPPLY_01', '°C', '', 20, 256, 190, 56),
      equip('hv-chiller', 'box', 'Tải chiller', 'HVAC_CHILLER_LOAD_01', '%', '', 250, 40, 190, 56),
      equip('hv-supply', 'box', 'Gió cấp', 'HVAC_SUPPLY_FLOW_01', 'm³/h', '', 250, 112, 190, 56),
      equip('hv-filter', 'box', 'ΔP bộ lọc gió', 'HVAC_FILTER_DP_01', 'Pa', '', 250, 184, 190, 56, [{ when: 'gt', value: 250, sev: 2 }]),
      equip('hv-fans', 'box', 'Số quạt chạy', 'HVAC_FANS_RUNNING_01', '', '', 250, 256, 190, 56),
    ],
  },
  {
    screenId: 'D3-fire-fighting',
    level: 'D3',
    title: { vi: 'Hệ chữa cháy — bố trí thiết bị', en: 'Fire Fighting Layout' },
    elements: [
      equip('fr-ring', 'box', 'Áp vòng ống chính', 'FIRE_RINGMAIN_PRESS_01', 'barg', '', 20, 40, 190, 56, [{ when: 'lt', value: 6, sev: 1 }]),
      equip('fr-tank', 'drum', 'Bồn nước chữa cháy', 'FIRE_TANK_LEVEL_01', '%', '', 20, 112, 190, 90, [{ when: 'lt', value: 30, sev: 2 }]),
      equip('fr-foam', 'box', 'Bình bọt (foam)', 'FIRE_FOAM_TANK_01', '%', '', 20, 222, 190, 56),
      equip('fr-zones', 'box', 'Vùng bình thường', 'FIRE_ZONES_NORMAL_01', '', '', 20, 294, 190, 56),
      equip('fr-alarm', 'box', 'Báo cháy (0/1)', 'FIRE_ALARM_ACTIVE_01', '', '', 250, 40, 190, 56, [{ when: 'gt', value: 0, sev: 1 }]),
      equip('fr-jockey', 'pump', 'Bơm jockey', 'FIRE_JOCKEY_RUNNING_01', '', '', 250, 112, 190, 56),
      equip('fr-main', 'pump', 'Bơm chính (điện)', 'FIRE_MAIN_PUMP_RUNNING_01', '', '', 250, 184, 190, 56),
      equip('fr-diesel', 'pump', 'Bơm diesel dự phòng', 'FIRE_DIESEL_PUMP_RUNNING_01', '', '', 250, 256, 190, 56),
    ],
  },
  {
    screenId: 'D3-chemical-dosing',
    level: 'D3',
    title: { vi: 'Hoá chất điều hoà chu trình — bố trí thiết bị', en: 'Cycle Chemical Dosing Layout' },
    elements: [
      // Amoniac (pH) · khử oxy · phosphate (bao hơi) → bơm định lượng theo lưu lượng; độ dẫn cation = tinh khiết.
      equip('cd-fwph', 'box', 'pH nước cấp', 'CHEM_FW_PH_01', '', '', 20, 40, 180, 56, [{ when: 'lt', value: 8.8, sev: 2 }]),
      equip('cd-drumph', 'box', 'pH bao hơi', 'CHEM_DRUM_PH_01', '', '', 20, 112, 180, 56, [{ when: 'lt', value: 9, sev: 2 }]),
      equip('cd-phos', 'box', 'Phosphate bao hơi', 'CHEM_DRUM_PHOSPHATE_01', 'ppm', '', 20, 184, 180, 56),
      equip('cd-cation', 'box', 'Độ dẫn cation hơi', 'CHEM_CATION_COND_01', 'µS/cm', '', 20, 256, 180, 56, [{ when: 'gt', value: 0.3, sev: 2 }]),
      equip('cd-nh3', 'pump', 'Bơm amoniac', 'CHEM_AMMONIA_DOSE_01', 'L/h', '', 250, 40, 190, 56),
      equip('cd-n2h4', 'pump', 'Bơm khử oxy', 'CHEM_HYDRAZINE_DOSE_01', 'L/h', '', 250, 112, 190, 56),
      equip('cd-po4', 'pump', 'Bơm phosphate', 'CHEM_PHOSPHATE_DOSE_01', 'L/h', '', 250, 184, 190, 56),
      equip('cd-tank', 'box', 'Bồn hoá chất ngày', 'CHEM_DOSING_TANK_01', '%', '', 250, 256, 190, 56, [{ when: 'lt', value: 20, sev: 2 }]),
    ],
  },
  {
    screenId: 'D3-avr-excitation',
    level: 'D3',
    title: { vi: 'AVR & hệ kích từ máy phát — bố trí thiết bị', en: 'AVR & Excitation System Layout' },
    elements: [
      // AVR giữ điện áp đầu cực bằng dòng kích từ → chi phối phản kháng (MVAr).
      equip('avr-vterm', 'box', 'Điện áp đầu cực', 'ELEC_TERM_VOLT_01', 'kV', '', 20, 40, 180, 56, [{ when: 'lt', value: 19, sev: 2 }]),
      equip('avr-vpu', 'box', 'Điện áp (pu)', 'ELEC_TERM_VOLT_PU_01', 'pu', '', 20, 112, 180, 56, [{ when: 'lt', value: 0.97, sev: 2 }]),
      equip('avr-sp', 'box', 'Setpoint AVR', 'ELEC_AVR_SETPOINT_01', 'pu', '', 20, 184, 180, 56),
      equip('avr-mode', 'box', 'AVR AUTO (0/1)', 'ELEC_AVR_MODE_01', '', '', 20, 256, 180, 56, [{ when: 'lt', value: 0.5, sev: 2 }]),
      pipe('avr-p1', 'elec', [{ x: 200, y: 68 }, { x: 250, y: 68 }, { x: 250, y: 90 }]),
      equip('avr-field', 'box', 'Dòng kích từ', 'ELEC_FIELD_CURRENT_01', 'A', '', 250, 40, 190, 56, [{ when: 'gt', value: 3800, sev: 2 }]),
      equip('avr-fieldv', 'box', 'Điện áp kích từ', 'ELEC_FIELD_VOLTAGE_01', 'V', '', 250, 112, 190, 56),
      equip('avr-exc', 'drum', 'Mức kích từ', 'ELEC_EXCITATION_01', '%', '', 250, 184, 190, 90, [{ when: 'gt', value: 95, sev: 2 }]),
      equip('avr-mvar', 'box', 'Phản kháng AVR', 'ELEC_REACTIVE_AVR_01', 'MVAr', 'D3-generator', 470, 40, 190, 56),
    ],
  },
  {
    screenId: 'D3-fwh-drains',
    level: 'D3',
    title: { vi: 'Drain cascade bình gia nhiệt — bố trí thiết bị', en: 'Feedwater Heater Drain Cascade Layout' },
    elements: [
      // Drain cascade: HP3→HP2→HP1→deaerator; LP4→…→LP1→bình ngưng. TTD/DCA + mức drain + van xả khẩn.
      equip('fwd-hph3', 'box', 'Drain HP3', 'FWH_HPH3_DRAIN_TEMP_01', '°C', '', 20, 40, 160, 56),
      equip('fwd-hph2', 'box', 'Drain HP2', 'FWH_HPH2_DRAIN_TEMP_01', '°C', '', 20, 112, 160, 56),
      equip('fwd-hph1', 'box', 'Drain HP1 → deaerator', 'FWH_HPH1_DRAIN_TEMP_01', '°C', '', 20, 184, 160, 56),
      equip('fwd-lph4', 'box', 'Drain LP4', 'FWH_LPH4_DRAIN_TEMP_01', '°C', '', 20, 256, 160, 56),
      equip('fwd-lph1', 'box', 'Drain LP1 → bình ngưng', 'FWH_LPH1_DRAIN_TEMP_01', '°C', 'D3-condenser-cw', 20, 328, 160, 56),
      equip('fwd-httd', 'box', 'TTD đoàn HP', 'FWH_HPH_TTD_01', '°C', '', 230, 40, 180, 56, [{ when: 'gt', value: 6, sev: 2 }]),
      equip('fwd-lttd', 'box', 'TTD đoàn LP', 'FWH_LPH_TTD_01', '°C', '', 230, 112, 180, 56, [{ when: 'gt', value: 6, sev: 2 }]),
      equip('fwd-dca', 'box', 'DCA đoàn HP', 'FWH_HPH_DCA_01', '°C', '', 230, 184, 180, 56),
      equip('fwd-hplvl', 'drum', 'Mức drain HP', 'FWH_HPH_DRAIN_LEVEL_01', '%', '', 230, 256, 180, 100, [{ when: 'gt', value: 80, sev: 2 }]),
      equip('fwd-lplvl', 'box', 'Mức drain LP', 'FWH_LPH_DRAIN_LEVEL_01', '%', '', 440, 40, 190, 56),
      equip('fwd-emerg', 'box', 'Van xả khẩn (0/1)', 'FWH_EMERG_DRAIN_01', '', '', 440, 112, 190, 56, [{ when: 'gt', value: 0, sev: 2 }]),
      equip('fwd-tocond', 'box', 'Drain → bình ngưng', 'FWH_DRAIN_TO_COND_01', 't/h', '', 440, 184, 190, 56),
    ],
  },
  {
    screenId: 'D2-calibration',
    level: 'D2',
    title: { vi: 'Hiệu chỉnh hiệu năng vs Design Basis', en: 'Performance Calibration vs Design Basis' },
    elements: [
      // Lượng hoá độ lệch KPI mô phỏng vs mốc Design Basis — bước ĐẦU của calibrate bằng heat-balance thật.
      valueTile('cal-hr-sim', 'PLANT_UNIT_HR_NET_01', 'Heat rate net (sim)', 'kJ/kWh', 0, 0),
      valueTile('cal-hr-tgt', 'PLANT_CAL_HR_TGT_01', 'Mốc Design Basis', 'kJ/kWh', 1, 0),
      valueTile('cal-hr-dev', 'PLANT_CAL_HR_DEV_01', 'Độ lệch heat rate', '%', 2, 0, [{ when: 'gt', value: 5, sev: 2 }]),
      valueTile('cal-eff-sim', 'PLANT_NET_EFF_01', 'Hiệu suất net (sim)', '%', 0, 1),
      valueTile('cal-eff-tgt', 'PLANT_CAL_EFF_TGT_01', 'Mốc Design Basis', '%', 1, 1),
      valueTile('cal-eff-dev', 'PLANT_CAL_EFF_DEV_01', 'Độ lệch hiệu suất', 'điểm%', 2, 1, [{ when: 'lt', value: -3, sev: 2 }]),
      valueTile('cal-cw-sim', 'CT_CW_SUPPLY_01', 'Nhiệt CW cấp (sim)', '°C', 0, 2),
      valueTile('cal-cw-tgt', 'PLANT_CAL_CW_TGT_01', 'Mốc thiết kế (ôn hoà)', '°C', 1, 2),
      valueTile('cal-cw-dev', 'PLANT_CAL_CW_DEV_01', 'Độ lệch CW (nhiệt đới)', '°C', 2, 2, [{ when: 'gt', value: 5, sev: 2 }]),
      valueTile('cal-clo-sim', 'PLANT_ENERGY_CLOSURE_01', 'Khép cân bằng NL', '%', 0, 3),
      valueTile('cal-clo-dev', 'PLANT_CAL_CLOSURE_DEV_01', 'Độ lệch khép (≈0 tốt)', 'điểm%', 2, 3),
      // Điều kiện hơi/chân không ĐƯỢC ĐIỀU KHIỂN — độ lệch ~0 chứng minh sim ở đúng điểm thiết kế
      // → gap heat-rate/η KHÔNG do sai điều kiện hơi (khu biệt nguyên nhân, M-06).
      valueTile('cal-mst-sim', 'BLR_MSTM_SH_TEMP_01', 'Nhiệt hơi chính (sim)', '°C', 0, 4),
      valueTile('cal-mst-tgt', 'PLANT_CAL_MST_TGT_01', 'Mốc Design Basis', '°C', 1, 4),
      valueTile('cal-mst-dev', 'PLANT_CAL_MST_DEV_01', 'Độ lệch nhiệt hơi chính', '°C', 2, 4, [{ when: 'gt', value: 5, sev: 2 }]),
      valueTile('cal-hrh-sim', 'TRB_HRH_TEMP_01', 'Nhiệt hot reheat (sim)', '°C', 0, 5),
      valueTile('cal-hrh-tgt', 'PLANT_CAL_HRH_TGT_01', 'Mốc Design Basis', '°C', 1, 5),
      valueTile('cal-hrh-dev', 'PLANT_CAL_HRH_DEV_01', 'Độ lệch nhiệt hot reheat', '°C', 2, 5, [{ when: 'gt', value: 5, sev: 2 }]),
      valueTile('cal-msp-sim', 'BLR_MSTM_SH_PRESS_01', 'Áp hơi chính (sim)', 'MPa', 0, 6),
      valueTile('cal-msp-tgt', 'PLANT_CAL_MSP_TGT_01', 'Mốc Design Basis', 'MPa', 1, 6),
      valueTile('cal-msp-dev', 'PLANT_CAL_MSP_DEV_01', 'Độ lệch áp hơi chính', 'MPa', 2, 6, [{ when: 'gt', value: 0.5, sev: 2 }]),
      valueTile('cal-vac-sim', 'TRB_COND_VACUUM_01', 'Chân không bình ngưng (sim)', 'kPa', 0, 7),
      valueTile('cal-vac-tgt', 'PLANT_CAL_VAC_TGT_01', 'Mốc Design Basis', 'kPa', 1, 7),
      valueTile('cal-vac-dev', 'PLANT_CAL_VAC_DEV_01', 'Độ lệch chân không', 'kPa', 2, 7, [{ when: 'gt', value: 1, sev: 2 }]),
    ],
  },
];

/** Tất cả tag mà một screen tham chiếu (để subscribe theo màn hình — Tag/Realtime). */
export function screenTags(screen: ScreenDef): string[] {
  const set = new Set<string>();
  for (const el of screen.elements) for (const b of el.bindings) set.add(b.tag);
  return [...set];
}
