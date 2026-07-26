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

/** 7 control loop Boiler Island (doc 09: boiler master · fuel master · air/O₂ · furnace draft ·
 *  main steam pressure · SH temp · drum level 3-element + governor tải). */
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
    desc: 'Boiler master / main steam pressure: giữ 17,5 MPa, FF theo hơi lấy đi → firing demand',
    pvTag: 'BLR_MSTM_SH_PRESS_01',
    sp: 17.5,
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
};
