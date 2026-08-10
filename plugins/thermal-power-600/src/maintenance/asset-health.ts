// Plugin thermal-power-600 — SỔ ĐĂNG KÝ SỨC KHOẺ TÀI SẢN (doc 20 §Cognitive, gói P2). Ánh xạ khái niệm
// "machine" của AI cognitive maintenance sang THIẾT BỊ NHÀ MÁY THẬT — mỗi tài sản khai báo các tín hiệu
// sức khoẻ dùng TAG CẢM BIẾN ĐÃ MÔ PHỎNG (verify: mọi tag nằm trong recordedTags của runtime). Dữ liệu
// THUẦN KHAI BÁO — engine SimulationCognitiveMaintenanceProvider suy đánh giá minh bạch, read-only.
//
// good = giá trị coi là lành mạnh (goodness 1); bad = hỏng (goodness 0); hướng tự suy từ good vs bad.
// good/bad/weight/designLifeH neo điểm vận hành mô phỏng (probe) + kỹ thuật thường quy → [GIẢ ĐỊNH] GĐ-142.
import type { AssetHealthSpec } from '@idtp/sdk';

export const thermalAssetHealth: ReadonlyArray<AssetHealthSpec> = [
  {
    assetId: 'BFP',
    name: { vi: 'Bơm nước cấp (BFP)', en: 'Boiler Feed Pump' },
    kind: 'pump',
    runTag: 'BFP_FLOW_01',
    designLifeH: 60000,
    signals: [
      { tag: 'BFP_NPSH_MARGIN_01', label: { vi: 'Biên NPSH', en: 'NPSH margin' }, good: 4, bad: 0, weight: 3, unit: 'm' },
      { tag: 'BFP_CAVITATION_01', label: { vi: 'Chỉ số xâm thực', en: 'Cavitation index' }, good: 0, bad: 1, weight: 2 },
    ],
  },
  {
    assetId: 'FAN-FD',
    name: { vi: 'Quạt gió cưỡng bức (FD)', en: 'Forced Draft Fan' },
    kind: 'fan',
    runTag: 'FAN_FD_FLOW_01',
    designLifeH: 80000,
    signals: [{ tag: 'FAN_FD_SURGE_MARGIN_01', label: { vi: 'Biên surge', en: 'Surge margin' }, good: 30, bad: 0, weight: 1, unit: '%' }],
  },
  {
    assetId: 'FAN-ID',
    name: { vi: 'Quạt khói cảm ứng (ID)', en: 'Induced Draft Fan' },
    kind: 'fan',
    runTag: 'FAN_ID_FLOW_01',
    designLifeH: 80000,
    signals: [{ tag: 'FAN_ID_SURGE_MARGIN_01', label: { vi: 'Biên surge', en: 'Surge margin' }, good: 30, bad: 0, weight: 1, unit: '%' }],
  },
  {
    assetId: 'TURBINE-GEN',
    name: { vi: 'Tuabin – Máy phát (cơ)', en: 'Turbine-Generator (mechanical)' },
    kind: 'turbine-generator',
    runTag: 'TRB_SPEED_01',
    designLifeH: 200000,
    signals: [
      { tag: 'TRB_VIB_01', label: { vi: 'Độ rung', en: 'Vibration' }, good: 2, bad: 11, weight: 3, unit: 'mm/s' },
      { tag: 'TRB_BRG_TEMP_01', label: { vi: 'Nhiệt gối trục', en: 'Bearing temp' }, good: 70, bad: 115, weight: 2, unit: '°C' },
      { tag: 'TSE_STRESS_PCT_01', label: { vi: 'Ứng suất nhiệt rotor', en: 'Rotor thermal stress' }, good: 0, bad: 100, weight: 2, unit: '%' },
      { tag: 'TSE_LIFE_USED_01', label: { vi: 'Tuổi thọ mỏi đã dùng', en: 'Fatigue life used' }, good: 0, bad: 100, weight: 1, unit: '%' },
    ],
  },
  {
    assetId: 'LUBE-OIL',
    name: { vi: 'Hệ dầu bôi trơn', en: 'Lube Oil System' },
    kind: 'other',
    designLifeH: 50000,
    signals: [
      { tag: 'LUBE_HEADER_PRESS_01', label: { vi: 'Áp góp dầu', en: 'Header pressure' }, good: 0.15, bad: 0.08, weight: 3, unit: 'MPa' },
      { tag: 'LUBE_FILTER_DP_01', label: { vi: 'ΔP lọc dầu', en: 'Filter ΔP' }, good: 0.2, bad: 1.5, weight: 2, unit: 'bar' },
      { tag: 'LUBE_BRG_MARGIN_01', label: { vi: 'Biên nhiệt gối', en: 'Bearing temp margin' }, good: 25, bad: 0, weight: 2, unit: '°C' },
    ],
  },
  {
    assetId: 'CONDENSER',
    name: { vi: 'Bình ngưng', en: 'Condenser' },
    kind: 'heat-exchanger',
    designLifeH: 150000,
    signals: [
      { tag: 'CNDP_CLEANLINESS_01', label: { vi: 'Độ sạch ống', en: 'Tube cleanliness' }, good: 100, bad: 60, weight: 2, unit: '%' },
      { tag: 'CNDP_TTD_01', label: { vi: 'TTD (chênh đầu cuối)', en: 'Terminal temp diff' }, good: 3, bad: 12, weight: 2, unit: '°C' },
      { tag: 'FA_COND_AIR_INLEAK_01', label: { vi: 'Lọt khí', en: 'Air in-leakage' }, good: 5, bad: 55, weight: 1, unit: 'scfm' },
    ],
  },
  {
    assetId: 'GENERATOR',
    name: { vi: 'Máy phát (điện/nhiệt)', en: 'Generator (electrical/thermal)' },
    kind: 'turbine-generator',
    runTag: 'GEN_MW_01',
    designLifeH: 200000,
    signals: [
      { tag: 'GEN_STATOR_TEMP_01', label: { vi: 'Nhiệt cuộn stator', en: 'Stator temp' }, good: 85, bad: 120, weight: 3, unit: '°C' },
      { tag: 'GCAP_MVA_LOADING_01', label: { vi: 'Tải MVA', en: 'MVA loading' }, good: 95, bad: 110, weight: 1, unit: '%' },
    ],
  },
  {
    assetId: 'HP-HEATER',
    name: { vi: 'Bình gia nhiệt cao áp', en: 'HP Feedwater Heater' },
    kind: 'heat-exchanger',
    designLifeH: 150000,
    signals: [{ tag: 'FWH_HPH_TTD_01', label: { vi: 'TTD gia nhiệt HP', en: 'HP heater TTD' }, good: 3, bad: 12, weight: 1, unit: '°C' }],
  },
  {
    assetId: 'LP-HEATER',
    name: { vi: 'Bình gia nhiệt hạ áp', en: 'LP Feedwater Heater' },
    kind: 'heat-exchanger',
    designLifeH: 150000,
    signals: [{ tag: 'FWH_LPH_TTD_01', label: { vi: 'TTD gia nhiệt LP', en: 'LP heater TTD' }, good: 3, bad: 12, weight: 1, unit: '°C' }],
  },
  {
    assetId: 'GSU-TRANSFORMER',
    name: { vi: 'MBA chính (GSU)', en: 'Generator Step-Up Transformer' },
    kind: 'transformer',
    designLifeH: 250000,
    signals: [{ tag: 'ELEC_GSU_LOADING_01', label: { vi: 'Tải MBA', en: 'Transformer loading' }, good: 90, bad: 115, weight: 1, unit: '%' }],
  },
  {
    assetId: 'AIR-COMPRESSOR',
    name: { vi: 'Máy nén khí điều khiển', en: 'Instrument Air Compressor' },
    kind: 'compressor',
    runTag: 'CA_COMP_RUNNING_01',
    designLifeH: 60000,
    signals: [{ tag: 'CA_COMP_RUNNING_01', label: { vi: 'Số máy nén chạy', en: 'Compressors running' }, good: 1, bad: 0, weight: 1 }],
  },
  {
    assetId: 'COAL-MILLS',
    name: { vi: 'Cụm máy nghiền than', en: 'Coal Mills' },
    kind: 'mill',
    runTag: 'COAL_MILLS_RUNNING_01',
    designLifeH: 40000,
    signals: [{ tag: 'COAL_MILL_LOADING_01', label: { vi: 'Tải nghiền', en: 'Mill loading' }, good: 85, bad: 115, weight: 1, unit: '%' }],
  },
  {
    assetId: 'CW-SYSTEM',
    name: { vi: 'Hệ nước tuần hoàn (CW)', en: 'Circulating Water System' },
    kind: 'pump',
    runTag: 'COND_CW_FLOW_01',
    designLifeH: 80000,
    signals: [{ tag: 'COND_CW_FLOW_01', label: { vi: 'Lưu lượng CW', en: 'CW flow' }, good: 60000, bad: 30000, weight: 2, unit: 'm³/h' }],
  },
  {
    assetId: 'DEAERATOR',
    name: { vi: 'Bình khử khí', en: 'Deaerator' },
    kind: 'tank',
    designLifeH: 200000,
    signals: [{ tag: 'FW_DEAERATOR_TEMP_01', label: { vi: 'Nhiệt khử khí', en: 'Deaeration temp' }, good: 155, bad: 135, weight: 1, unit: '°C' }],
  },
  {
    assetId: 'ESP',
    name: { vi: 'Lọc bụi tĩnh điện (ESP)', en: 'Electrostatic Precipitator' },
    kind: 'other',
    designLifeH: 150000,
    signals: [
      { tag: 'EMI_ESP_EFF_01', label: { vi: 'Hiệu suất lọc bụi', en: 'Collection efficiency' }, good: 99.5, bad: 96, weight: 2, unit: '%' },
      { tag: 'EMI_DUST_STACK_01', label: { vi: 'Bụi ống khói', en: 'Stack dust' }, good: 30, bad: 150, weight: 1, unit: 'mg/m³' },
    ],
  },
  {
    assetId: 'SCR',
    name: { vi: 'Khử NOx (SCR)', en: 'SCR deNOx' },
    kind: 'other',
    designLifeH: 100000,
    signals: [
      { tag: 'ECTL_SCR_ACTIVITY_01', label: { vi: 'Hoạt tính xúc tác', en: 'Catalyst activity' }, good: 100, bad: 50, weight: 2, unit: '%' },
      { tag: 'ECTL_NH3_SLIP_01', label: { vi: 'Rò NH₃ (ammonia slip)', en: 'Ammonia slip' }, good: 2, bad: 18, weight: 2, unit: 'ppm' },
      { tag: 'ECTL_SCR_REMOVAL_01', label: { vi: 'Độ khử NOx', en: 'NOx removal' }, good: 55, bad: 25, weight: 1, unit: '%' },
    ],
  },
  {
    assetId: 'FGD',
    name: { vi: 'Khử SO₂ (FGD)', en: 'FGD deSOx' },
    kind: 'other',
    designLifeH: 120000,
    signals: [
      { tag: 'ECTL_FGD_REMOVAL_01', label: { vi: 'Độ khử SO₂', en: 'SO₂ removal' }, good: 90, bad: 70, weight: 2, unit: '%' },
      { tag: 'ECTL_FGD_PH_01', label: { vi: 'pH slurry đá vôi', en: 'Limestone slurry pH' }, good: 5.5, bad: 4.5, weight: 1 },
    ],
  },
  {
    assetId: 'COOLING-TOWER',
    name: { vi: 'Tháp giải nhiệt', en: 'Cooling Tower' },
    kind: 'other',
    designLifeH: 150000,
    signals: [{ tag: 'CT_APPROACH_01', label: { vi: 'Approach (cận nhiệt ướt)', en: 'Approach to wet-bulb' }, good: 5, bad: 13, weight: 1, unit: '°C' }],
  },
];
