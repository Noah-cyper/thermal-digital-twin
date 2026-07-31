// Plugin thermal-power-600 — control loop KHAI BÁO (doc 09 §1). Dữ liệu thuần: CHỈ import type
// từ @idtp/sdk (luật L-P1). Control Engine (@idtp/engines) chạy các loop này bằng PidController.
// PID params khởi điểm: doc 10 §9 (GĐ-21, tuning trên sim). CCS coordinated: boiler-follow áp +
// feedforward theo tải (doc 09 §2).
import type { ControlLoopDef } from '@idtp/sdk';

// Hằng chuyển đổi (khớp BoilerIslandModel): COAL_MAX 300 t/h, BMCR 2008 t/h, FW_MAX 2100 t/h.
const FIRING_TO_COAL = 3.0; // firing % → coal SP (t/h) = firing × COAL_MAX/100
const DRAW_TO_FIRING = 100 / 2008; // steam draw (t/h) → firing base (%)
const FIRING_TO_AIR = 0.83; // firing % → FD damper base (%)
const STEAM_TO_FWCV = 100 / 2100; // steam flow (t/h) → FW CV feedforward (%)
const STEAM_TO_DEALCV = 100 / 2200; // steam flow (t/h) → deaerator condensate LCV feedforward (%)
const STEAM_TO_CEPLCV = 100 / 2200; // steam flow (t/h) → condensate extraction pump LCV feedforward (%)

/** 15 control loop Boiler Island + môi trường + phụ trợ (doc 09): governor · boiler master (sliding
 *  pressure) · fuel master · air/O₂ · furnace draft · SH temp · drum level 3-element · deaerator level ·
 *  hotwell level · reheat temp (gas-biasing) · BFP min-flow recirc · SCR deNOx (NH₃) · FGD SO₂ (slurry) ·
 *  deaerator pressure (pegging steam) · gland steam pressure. Coordinated master = boiler-follow + áp trượt. */
export const boilerControlLoops: ReadonlyArray<ControlLoopDef> = [
  {
    id: 'governor',
    desc: 'Turbine governor: đặt lưu lượng hơi lấy đi theo lệnh tải MW',
    pvTag: 'GEN_MW_01',
    spTag: 'BLR_MW_DEMAND',
    kp: 3,
    ki: 0.3,
    kd: 0,
    outLo: 0,
    outHi: 2200,
    outTag: 'BLR_TURBINE_DEMAND_01',
  },
  {
    id: 'boiler-master-pressure',
    desc: 'Boiler master / main steam pressure: bám setpoint TRƯỢT theo tải (coordinated master, BLR_PRESS_SP), FF theo hơi lấy đi → firing demand',
    pvTag: 'BLR_MSTM_SH_PRESS_01',
    spTag: 'BLR_PRESS_SP',
    kp: 2,
    ki: 0.03,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'BLR_TURBINE_DEMAND_01',
    ffGain: DRAW_TO_FIRING,
    outTag: 'BLR_FIRING_DEMAND',
  },
  {
    id: 'fuel-master',
    desc: 'Fuel master (cascade): coal flow bám firing demand',
    pvTag: 'BLR_COAL_FLOW_01',
    spTag: 'BLR_FIRING_DEMAND',
    spScale: FIRING_TO_COAL,
    kp: 0.3,
    ki: 0.2,
    kd: 0,
    outLo: 0,
    outHi: 100,
    outTag: 'BLR_FUEL_DEMAND_01',
  },
  {
    id: 'air-o2-trim',
    desc: 'Air flow / O₂ trim: giữ O₂ 3,2%, FF theo firing → FD damper',
    pvTag: 'BLR_FLUE_O2_01',
    sp: 3.2,
    kp: 1.5,
    ki: 0.3,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'BLR_FIRING_DEMAND',
    ffGain: FIRING_TO_AIR,
    outTag: 'BLR_FD_DAMPER_01',
  },
  {
    id: 'furnace-draft',
    desc: 'Furnace draft: giữ −50 Pa, reverse-acting, FF theo FD damper → ID guide vane',
    pvTag: 'BLR_FURN_PRESS_01',
    sp: -50,
    kp: 0.05,
    ki: 0.02,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'BLR_FD_DAMPER_01',
    ffGain: 1.0,
    reverse: true,
    outTag: 'BLR_ID_VANE_01',
  },
  {
    id: 'sh-temp',
    desc: 'SH steam temp (spray attemperator): giữ 541 °C, reverse-acting',
    pvTag: 'BLR_MSTM_SH_TEMP_01',
    sp: 541,
    kp: 0.8,
    ki: 0.02,
    kd: 0.1,
    outLo: 0,
    outHi: 100,
    reverse: true,
    outTag: 'BLR_SH_SPRAY_CV_01',
  },
  {
    id: 'drum-level',
    desc: 'Drum level 3-element: giữ 0 mm, FF theo steam flow → FW control valve',
    pvTag: 'BLR_DRUM_LEVEL_01',
    sp: 0,
    kp: 0.006,
    ki: 0.002,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'BLR_STEAM_FLOW_01',
    ffGain: STEAM_TO_FWCV,
    outTag: 'BLR_FW_CV_01',
  },
  {
    id: 'deaerator-level',
    desc: 'Deaerator level: giữ 50%, FF theo hơi (condensate ≈ hơi, cân bằng khối lượng) → van mức condensate (LCV)',
    pvTag: 'FW_DEAERATOR_LEVEL_01',
    sp: 50,
    kp: 0.8,
    ki: 0.05,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'BLR_STEAM_FLOW_01',
    ffGain: STEAM_TO_DEALCV,
    outTag: 'FW_DEA_LCV_01',
  },
  {
    id: 'hotwell-level',
    desc: 'Hotwell level: giữ 50%, reverse (mức cao → bơm ngưng ra nhiều), FF theo hơi → van bơm ngưng (CEP LCV)',
    pvTag: 'COND_HOTWELL_LEVEL_01',
    sp: 50,
    kp: 0.8,
    ki: 0.05,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'BLR_STEAM_FLOW_01',
    ffGain: STEAM_TO_CEPLCV,
    reverse: true,
    outTag: 'COND_CEP_LCV_01',
  },
  {
    id: 'reheat-temp',
    desc: 'Reheat steam temp: giữ hot reheat 541 °C bằng gas-biasing (bù droop non tải) → TRB_RH_BIAS',
    pvTag: 'TRB_HRH_TEMP_01',
    sp: 541,
    kp: 1.2,
    ki: 0.05,
    kd: 0,
    outLo: 0,
    outHi: 100,
    outTag: 'TRB_RH_BIAS_01',
  },
  {
    id: 'bfp-recirc',
    desc: 'BFP minimum-flow recirc: bảo vệ bơm nước cấp — mở recirc khi lưu lượng < ~350 t/h (direct)',
    pvTag: 'BLR_FW_FLOW_01',
    sp: 350,
    kp: 0.4,
    ki: 0.05,
    kd: 0,
    outLo: 0,
    outHi: 100,
    outTag: 'BLR_BFP_RECIRC_01',
  },
  {
    id: 'scr-nox',
    desc: 'SCR deNOx: giữ NOₓ ống khói ~150 mg/Nm³ bằng phun NH₃ (phản hồi outlet-NOx, reverse)',
    pvTag: 'EMI_NOX_STACK_01',
    sp: 150,
    kp: 0.2,
    ki: 0.02,
    kd: 0,
    outLo: 0,
    outHi: 100,
    reverse: true,
    outTag: 'EMI_NH3_INJ_01',
  },
  {
    id: 'fgd-so2',
    desc: 'FGD SO₂: giữ SO₂ ống khói ~61 mg/Nm³ bằng cấp slurry đá vôi (reverse)',
    pvTag: 'EMI_SO2_STACK_01',
    sp: 61,
    kp: 0.3,
    ki: 0.03,
    kd: 0,
    outLo: 0,
    outHi: 100,
    reverse: true,
    outTag: 'EMI_FGD_SLURRY_01',
  },
  {
    id: 'deaerator-pressure',
    desc: 'Áp bể khử khí: giữ 0,9 MPa bằng van pegging steam (bù khi hơi trích non tải thiếu, direct)',
    pvTag: 'FW_DEA_PRESS_01',
    sp: 0.9,
    kp: 150,
    ki: 15,
    kd: 0,
    outLo: 0,
    outHi: 100,
    outTag: 'FW_DEA_PEG_VALVE_01',
  },
  {
    id: 'gland-steam-pressure',
    desc: 'Áp hơi chèn trục: giữ 5 kPag bằng van cấp hơi chèn (bù khi tải thấp chưa tự chèn, direct)',
    pvTag: 'TRB_GLAND_PRESS_01',
    sp: 5,
    kp: 8,
    ki: 1,
    kd: 0,
    outLo: 0,
    outHi: 100,
    outTag: 'TRB_GLAND_VALVE_01',
  },
];

/** Điểm vận hành khởi động (~1500 t/h hơi / ~448 MW) — nạp bumpless MAN→AUTO để khởi động êm.
 *  loopId → giá trị OP ban đầu. */
export const boilerLoopSeeds: Readonly<Record<string, number>> = {
  governor: 1500, // BLR_TURBINE_DEMAND_01 (t/h) — ~448 MW
  'boiler-master-pressure': 70.3, // BLR_FIRING_DEMAND (%) — coal ~211 t/h → steam ~1500
  'fuel-master': 70.3, // BLR_FUEL_DEMAND_01 (%)
  'air-o2-trim': 62, // BLR_FD_DAMPER_01 (%) — O₂ ~3,2%
  'furnace-draft': 62, // BLR_ID_VANE_01 (%)
  'sh-temp': 21, // BLR_SH_SPRAY_CV_01 (%) — 541 °C
  'drum-level': 71, // BLR_FW_CV_01 (%)
  'deaerator-level': 68, // FW_DEA_LCV_01 (%) — condensate ~1500 t/h giữ mức 50%
  'hotwell-level': 68, // COND_CEP_LCV_01 (%) — bơm ngưng ~1500 t/h giữ mức 50%
  'reheat-temp': 50, // TRB_RH_BIAS_01 (%) — gas-biasing giữ hot reheat 541 °C
  'bfp-recirc': 0, // BLR_BFP_RECIRC_01 (%) — recirc đóng ở tải (lưu lượng cao)
  'scr-nox': 62.5, // EMI_NH3_INJ_01 (%) — NH₃ khử NOₓ 320→150 (scrEff ~0,53) tại điểm vận hành
  'fgd-so2': 55.6, // EMI_FGD_SLURRY_01 (%) — slurry giữ FGD 0,95 (SO₂ ~61) tại điểm vận hành
  'deaerator-pressure': 30.6, // FW_DEA_PEG_VALVE_01 (%) — pegging bù hơi trích 0,75→0,9 MPa
  'gland-steam-pressure': 33.5, // TRB_GLAND_VALVE_01 (%) — van chèn bù tự chèn 3→5 kPag tại điểm vận hành
};
