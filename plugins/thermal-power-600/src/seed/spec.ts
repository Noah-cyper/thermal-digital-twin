// Spec seed toàn plugin thermal-power-600 (doc 07 §4/§5 roll-up ≥ 3.000 tag; doc 08 §4 ~650 alarm).
// DỮ LIỆU khai báo, chỉ import @idtp/sdk. SeedGenerator (@idtp/engines) expand → registry đầy đủ.
//
// Roll-up dự kiến theo khu vực (doc 07 §4) — kiểm bằng test/seed.test.ts:
//   Boiler 600 · Turbine 474 · Generator 176 · Electrical 515 · Switchyard 240 · CW 90 ·
//   FlueGas 262 · Coal 300 · Ash 151 · BoP 514 · Calc/Derived 200  →  Σ ~3.522 tag
// Alarm rationalized (chỉ suffix bảo vệ trong alarmTemplates) → ~651 alarm (ISA-18.2, chống flood).
//
// KKS breadth = [GIẢ ĐỊNH] có cấu trúc (GĐ-04, chờ đối chiếu VGB-B 106). source='opcua' = đường thu
// thập hiện trường ở bản triển khai thật; v1 chỉ mô phỏng lõi Boiler Island (17 tag sim riêng).
import type { InstanceGroup, PlantSeedSpec } from '@idtp/sdk';
import { thermalTagTemplates } from './templates';

const AREA = 'unit1';

const instances: InstanceGroup[] = [
  /* ── Boiler Island (~600) ── */
  { template: 'mill', area: AREA, cell: 'boiler', unit: 'pulverizer', equip: 'mill', count: 6, namePrefix: 'BLR_MILL', kksSystem: 'HFC', descVi: 'Máy nghiền than', descEn: 'Coal pulverizer', source: 'sim', simModelRef: 'thermal-boiler-island' },
  { template: 'fan', area: AREA, cell: 'boiler', unit: 'fd-fan', equip: 'fdfan', count: 2, namePrefix: 'BLR_FDFAN', kksSystem: 'HLA', descVi: 'Quạt gió cấp (FD)', descEn: 'Forced draft fan' },
  { template: 'fan', area: AREA, cell: 'boiler', unit: 'id-fan', equip: 'idfan', count: 2, namePrefix: 'BLR_IDFAN', kksSystem: 'HLB', descVi: 'Quạt khói (ID)', descEn: 'Induced draft fan' },
  { template: 'fan', area: AREA, cell: 'boiler', unit: 'pa-fan', equip: 'pafan', count: 2, namePrefix: 'BLR_PAFAN', kksSystem: 'HLC', descVi: 'Quạt gió sơ cấp (PA)', descEn: 'Primary air fan' },
  { template: 'transmitter', area: AREA, cell: 'boiler', unit: 'measurement', equip: 'xmtr', count: 140, namePrefix: 'BLR_XMTR', kksSystem: 'HAD', descVi: 'Đo lường lò hơi', descEn: 'Boiler measurement', source: 'sim', simModelRef: 'thermal-boiler-island' },
  { template: 'control_loop', area: AREA, cell: 'boiler', unit: 'control', equip: 'loop', count: 6, namePrefix: 'BLR_LOOP', kksSystem: 'HAG', descVi: 'Vòng điều khiển lò', descEn: 'Boiler control loop' },

  /* ── Turbine Island (~474) ── */
  { template: 'transmitter', area: AREA, cell: 'turbine', unit: 'measurement', equip: 'xmtr', count: 90, namePrefix: 'TRB_XMTR', kksSystem: 'MAY', descVi: 'Đo lường turbine', descEn: 'Turbine measurement' },
  { template: 'motor_pump', area: AREA, cell: 'turbine', unit: 'pumps', equip: 'pump', count: 8, namePrefix: 'TRB_PUMP', kksSystem: 'LAC', descVi: 'Bơm nước cấp/ngưng', descEn: 'Feed/condensate pump' },
  { template: 'heater_vessel', area: AREA, cell: 'turbine', unit: 'heaters', equip: 'htr', count: 10, namePrefix: 'TRB_HTR', kksSystem: 'LAB', descVi: 'Gia nhiệt/bình', descEn: 'Heater/vessel' },
  { template: 'control_loop', area: AREA, cell: 'turbine', unit: 'control', equip: 'loop', count: 8, namePrefix: 'TRB_LOOP', kksSystem: 'MAA', descVi: 'Vòng điều khiển turbine', descEn: 'Turbine control loop' },

  /* ── Generator + Excitation (~176) ── */
  { template: 'transmitter', area: AREA, cell: 'generator', unit: 'measurement', equip: 'xmtr', count: 40, namePrefix: 'GEN_XMTR', kksSystem: 'MKA', descVi: 'Đo lường máy phát', descEn: 'Generator measurement' },
  { template: 'breaker', area: AREA, cell: 'generator', unit: 'breaker', equip: 'cb', count: 2, namePrefix: 'GEN_CB', kksSystem: 'MKD', descVi: 'Máy cắt máy phát', descEn: 'Generator breaker' },
  { template: 'control_loop', area: AREA, cell: 'generator', unit: 'control', equip: 'loop', count: 2, namePrefix: 'GEN_LOOP', kksSystem: 'MKC', descVi: 'Vòng AVR/H2', descEn: 'AVR/H2 loop' },
  { template: 'motor_pump', area: AREA, cell: 'generator', unit: 'aux', equip: 'pump', count: 3, namePrefix: 'GEN_PUMP', kksSystem: 'MKW', descVi: 'Bơm dầu chèn/H2', descEn: 'Seal oil/H2 pump' },

  /* ── Electrical (~515) ── */
  { template: 'breaker', area: AREA, cell: 'electrical', unit: 'switchgear', equip: 'cb', count: 70, namePrefix: 'ELE_CB', kksSystem: 'BFA', descVi: 'Máy cắt phân phối', descEn: 'Distribution breaker' },
  { template: 'transmitter', area: AREA, cell: 'electrical', unit: 'measurement', equip: 'xmtr', count: 55, namePrefix: 'ELE_XMTR', kksSystem: 'BFB', descVi: 'Đo lường điện', descEn: 'Electrical measurement' },

  /* ── Switchyard 500 kV (~240) ── */
  { template: 'breaker', area: AREA, cell: 'switchyard', unit: 'bay', equip: 'cb', count: 30, namePrefix: 'SWY_CB', kksSystem: 'AAN', descVi: 'Máy cắt ngăn lộ', descEn: 'Bay breaker' },
  { template: 'transmitter', area: AREA, cell: 'switchyard', unit: 'measurement', equip: 'xmtr', count: 30, namePrefix: 'SWY_XMTR', kksSystem: 'AAP', descVi: 'CT/VT trạm', descEn: 'Switchyard CT/VT' },

  /* ── Cooling Water + Tower (~90) ── */
  { template: 'motor_pump', area: AREA, cell: 'cw', unit: 'cw-pump', equip: 'pump', count: 6, namePrefix: 'CW_PUMP', kksSystem: 'PAC', descVi: 'Bơm nước làm mát', descEn: 'Cooling water pump' },
  { template: 'transmitter', area: AREA, cell: 'cw', unit: 'measurement', equip: 'xmtr', count: 10, namePrefix: 'CW_XMTR', kksSystem: 'PAB', descVi: 'Đo lường nước làm mát', descEn: 'CW measurement' },

  /* ── Flue Gas / Emission (~262) ── */
  { template: 'analyzer', area: AREA, cell: 'flue-gas', unit: 'cems', equip: 'anz', count: 24, namePrefix: 'FLG_ANZ', kksSystem: 'HNE', descVi: 'Phân tích khí thải (CEMS)', descEn: 'CEMS analyzer' },
  { template: 'motor_pump', area: AREA, cell: 'flue-gas', unit: 'fgd', equip: 'pump', count: 4, namePrefix: 'FLG_PUMP', kksSystem: 'HTA', descVi: 'Bơm FGD', descEn: 'FGD pump' },
  { template: 'transmitter', area: AREA, cell: 'flue-gas', unit: 'measurement', equip: 'xmtr', count: 30, namePrefix: 'FLG_XMTR', kksSystem: 'HNA', descVi: 'Đo lường khói', descEn: 'Flue gas measurement' },
  { template: 'heater_vessel', area: AREA, cell: 'flue-gas', unit: 'absorber', equip: 'vsl', count: 2, namePrefix: 'FLG_VSL', kksSystem: 'HTB', descVi: 'Tháp hấp thụ FGD', descEn: 'FGD absorber' },

  /* ── Coal Handling (~300) ── */
  { template: 'motor_pump', area: AREA, cell: 'coal', unit: 'conveyor', equip: 'cv', count: 20, namePrefix: 'COA_CV', kksSystem: 'EGA', descVi: 'Băng tải/máy nghiền than', descEn: 'Coal conveyor/crusher' },
  { template: 'transmitter', area: AREA, cell: 'coal', unit: 'measurement', equip: 'xmtr', count: 30, namePrefix: 'COA_XMTR', kksSystem: 'EGB', descVi: 'Đo lường than', descEn: 'Coal measurement' },
  { template: 'breaker', area: AREA, cell: 'coal', unit: 'switchgear', equip: 'cb', count: 2, namePrefix: 'COA_CB', kksSystem: 'EGD', descVi: 'Máy cắt than', descEn: 'Coal breaker' },

  /* ── Ash Handling (~151) ── */
  { template: 'motor_pump', area: AREA, cell: 'ash', unit: 'conveying', equip: 'cv', count: 10, namePrefix: 'ASH_CV', kksSystem: 'EKA', descVi: 'Vận chuyển tro', descEn: 'Ash conveying' },
  { template: 'transmitter', area: AREA, cell: 'ash', unit: 'measurement', equip: 'xmtr', count: 17, namePrefix: 'ASH_XMTR', kksSystem: 'EKB', descVi: 'Đo lường tro', descEn: 'Ash measurement' },

  /* ── BoP (~514) ── */
  { template: 'motor_pump', area: AREA, cell: 'fuel-oil', unit: 'fo-pump', equip: 'pump', count: 4, namePrefix: 'FUO_PUMP', kksSystem: 'EHA', descVi: 'Bơm dầu đốt', descEn: 'Fuel oil pump' },
  { template: 'transmitter', area: AREA, cell: 'fuel-oil', unit: 'measurement', equip: 'xmtr', count: 6, namePrefix: 'FUO_XMTR', kksSystem: 'EHB', descVi: 'Đo lường dầu đốt', descEn: 'Fuel oil measurement' },
  { template: 'motor_pump', area: AREA, cell: 'wtp', unit: 'wtp-pump', equip: 'pump', count: 6, namePrefix: 'WTP_PUMP', kksSystem: 'GHA', descVi: 'Bơm xử lý nước', descEn: 'Water treatment pump' },
  { template: 'transmitter', area: AREA, cell: 'wtp', unit: 'measurement', equip: 'xmtr', count: 10, namePrefix: 'WTP_XMTR', kksSystem: 'GHB', descVi: 'Đo lường xử lý nước', descEn: 'WTP measurement' },
  { template: 'control_loop', area: AREA, cell: 'wtp', unit: 'control', equip: 'loop', count: 2, namePrefix: 'WTP_LOOP', kksSystem: 'GHC', descVi: 'Vòng điều khiển WTP', descEn: 'WTP control loop' },
  { template: 'motor_pump', area: AREA, cell: 'dosing', unit: 'dosing-pump', equip: 'pump', count: 6, namePrefix: 'DOS_PUMP', kksSystem: 'GMA', descVi: 'Bơm định lượng hoá chất', descEn: 'Chemical dosing pump' },
  { template: 'transmitter', area: AREA, cell: 'dosing', unit: 'measurement', equip: 'xmtr', count: 4, namePrefix: 'DOS_XMTR', kksSystem: 'GMB', descVi: 'Đo lường hoá chất', descEn: 'Dosing measurement' },
  { template: 'motor_pump', area: AREA, cell: 'air', unit: 'compressor', equip: 'comp', count: 4, namePrefix: 'AIR_COMP', kksSystem: 'SCA', descVi: 'Máy nén khí', descEn: 'Air compressor' },
  { template: 'transmitter', area: AREA, cell: 'air', unit: 'measurement', equip: 'xmtr', count: 6, namePrefix: 'AIR_XMTR', kksSystem: 'SCB', descVi: 'Đo lường khí nén', descEn: 'Compressed air measurement' },
  { template: 'motor_pump', area: AREA, cell: 'fire', unit: 'fire-pump', equip: 'pump', count: 4, namePrefix: 'FIR_PUMP', kksSystem: 'SGA', descVi: 'Bơm cứu hoả', descEn: 'Fire pump' },
  { template: 'transmitter', area: AREA, cell: 'fire', unit: 'measurement', equip: 'xmtr', count: 6, namePrefix: 'FIR_XMTR', kksSystem: 'SGB', descVi: 'Đo lường cứu hoả', descEn: 'Fire fighting measurement' },
  { template: 'fan', area: AREA, cell: 'hvac', unit: 'ahu', equip: 'ahu', count: 6, namePrefix: 'HVA_AHU', kksSystem: 'SAC', descVi: 'Quạt HVAC', descEn: 'HVAC fan' },
  { template: 'transmitter', area: AREA, cell: 'hvac', unit: 'measurement', equip: 'xmtr', count: 6, namePrefix: 'HVA_XMTR', kksSystem: 'SAB', descVi: 'Đo lường HVAC', descEn: 'HVAC measurement' },
  { template: 'breaker', area: AREA, cell: 'diesel', unit: 'switchgear', equip: 'cb', count: 2, namePrefix: 'DSL_CB', kksSystem: 'BRA', descVi: 'Máy cắt diesel', descEn: 'Diesel breaker' },
  { template: 'transmitter', area: AREA, cell: 'diesel', unit: 'measurement', equip: 'xmtr', count: 8, namePrefix: 'DSL_XMTR', kksSystem: 'BRB', descVi: 'Đo lường diesel', descEn: 'Diesel measurement' },
  { template: 'breaker', area: AREA, cell: 'ups', unit: 'switchgear', equip: 'cb', count: 4, namePrefix: 'UPS_CB', kksSystem: 'BTA', descVi: 'Máy cắt UPS', descEn: 'UPS breaker' },
  { template: 'transmitter', area: AREA, cell: 'ups', unit: 'measurement', equip: 'xmtr', count: 10, namePrefix: 'UPS_XMTR', kksSystem: 'BTB', descVi: 'Đo lường UPS/ắc quy', descEn: 'UPS/battery measurement' },

  /* ── Control loop breadth (BoP) — cho loop generator §10 (≥ 25) ── */
  { template: 'control_loop', area: AREA, cell: 'flue-gas', unit: 'control', equip: 'loop', count: 3, namePrefix: 'FLG_LOOP', kksSystem: 'HTC', descVi: 'Vòng điều khiển FGD', descEn: 'FGD control loop' },
  { template: 'control_loop', area: AREA, cell: 'coal', unit: 'control', equip: 'loop', count: 4, namePrefix: 'COA_LOOP', kksSystem: 'EGC', descVi: 'Vòng điều khiển than', descEn: 'Coal control loop' },
  { template: 'control_loop', area: AREA, cell: 'air', unit: 'control', equip: 'loop', count: 2, namePrefix: 'AIR_LOOP', kksSystem: 'SCC', descVi: 'Vòng áp khí nén', descEn: 'Air pressure loop' },
  { template: 'control_loop', area: AREA, cell: 'hvac', unit: 'control', equip: 'loop', count: 2, namePrefix: 'HVA_LOOP', kksSystem: 'SAD', descVi: 'Vòng nhiệt độ HVAC', descEn: 'HVAC temperature loop' },

  /* ── Calc / KPI / derived (~200) ── */
  { template: 'calc_point', area: AREA, cell: 'system', unit: 'derived', equip: 'calc', count: 200, namePrefix: 'SYS_CALC', kksSystem: 'CJA', descVi: 'Điểm dẫn xuất/KPI', descEn: 'Derived/KPI point', source: 'calc' },
];

export const thermalSeedSpec: PlantSeedSpec = {
  enterprise: 'hoantran',
  site: 'haiphong',
  idNamespace: 'thermal-power-600',
  templates: thermalTagTemplates,
  instances,
  // Template alarm rationalized (doc 08) — CHỈ suffix bảo vệ ở đây mới sinh alarm. Setpoint suy từ
  // range (breadth = [GIẢ ĐỊNH], GĐ-42). Điều kiện: bool→DISCRETE, float→HH.
  alarmTemplates: [
    { suffix: 'TRIP', condition: 'DISCRETE', priority: 'P1', setpointRule: 'discreteTrue', onDelayMs: 500, offDelayMs: 3000, consequenceVi: 'Thiết bị trip → mất chức năng', consequenceEn: 'Equipment trip -> loss of function', correctiveVi: 'Kiểm nguyên nhân trip; reset khi an toàn', correctiveEn: 'Check trip cause; reset when safe' },
    { suffix: 'FEEDER_TRIP', condition: 'DISCRETE', priority: 'P1', setpointRule: 'discreteTrue', onDelayMs: 500, offDelayMs: 3000, consequenceVi: 'Trip feeder cấp than', consequenceEn: 'Coal feeder trip', correctiveVi: 'Kiểm feeder/mill', correctiveEn: 'Check feeder/mill' },
    { suffix: 'OUTLET_TEMP', condition: 'HH', priority: 'P1', setpointRule: 'rangeHiWarn', deadbandPct: 1, onDelayMs: 3000, offDelayMs: 10000, consequenceVi: 'Nhiệt ra cao → nguy cơ cháy bột than', consequenceEn: 'High outlet temp -> coal dust fire risk', correctiveVi: 'Trip mill; kiểm PA/seal air', correctiveEn: 'Trip mill; check PA/seal air' },
    { suffix: 'BRG_VIB', condition: 'HH', priority: 'P2', setpointRule: 'rangeHiWarn', deadbandPct: 2, onDelayMs: 2000, offDelayMs: 8000, consequenceVi: 'Rung ổ trục cao → hư hỏng cơ khí', consequenceEn: 'High bearing vibration -> mechanical damage', correctiveVi: 'Giảm tải; lên kế hoạch kiểm tra', correctiveEn: 'Reduce load; schedule inspection' },
    { suffix: 'WIND_TEMP', condition: 'HH', priority: 'P2', setpointRule: 'rangeHiWarn', deadbandPct: 1, onDelayMs: 5000, offDelayMs: 10000, consequenceVi: 'Nhiệt cuộn dây cao → giảm tuổi thọ cách điện', consequenceEn: 'High winding temp -> insulation aging', correctiveVi: 'Giảm dòng; kiểm làm mát', correctiveEn: 'Reduce current; check cooling' },
    { suffix: 'FAULT', condition: 'DISCRETE', priority: 'P2', setpointRule: 'discreteTrue', onDelayMs: 1000, offDelayMs: 5000, consequenceVi: 'Lỗi vòng điều khiển/analyzer', consequenceEn: 'Control loop/analyzer fault', correctiveVi: 'Chuyển MAN; kiểm thiết bị', correctiveEn: 'Switch to MAN; check device' },
    { suffix: 'PROT', condition: 'DISCRETE', priority: 'P2', setpointRule: 'discreteTrue', onDelayMs: 200, offDelayMs: 5000, consequenceVi: 'Bảo vệ điện tác động', consequenceEn: 'Electrical protection operated', correctiveVi: 'Kiểm sự cố; phối hợp điều độ', correctiveEn: 'Check fault; coordinate with dispatch' },
    { suffix: 'VOLTAGE', condition: 'HH', priority: 'P2', setpointRule: 'rangeHiWarn', deadbandPct: 1, onDelayMs: 2000, offDelayMs: 8000, consequenceVi: 'Quá áp thanh cái', consequenceEn: 'Busbar overvoltage', correctiveVi: 'Điều chỉnh kích từ/tap', correctiveEn: 'Adjust excitation/tap' },
  ],
};
