// Plugin water-treatment-demo — control loop KHAI BÁO. Chỉ import type từ @idtp/sdk. Cùng
// ControlLoopEngine generic (@idtp/engines) chạy — không sửa engine. Params demo [GIẢ ĐỊNH].
import type { ControlLoopDef } from '@idtp/sdk';

export const waterControlLoops: ReadonlyArray<ControlLoopDef> = [
  {
    id: 'tank-level',
    desc: 'Điều khiển mức bể DM: giữ 60%, FF theo nhu cầu ra → van cấp',
    pvTag: 'WTP_TANK_LEVEL_01',
    sp: 60,
    kp: 2.5,
    ki: 0.08,
    kd: 0,
    outLo: 0,
    outHi: 100,
    ffTag: 'WTP_DEMAND_01',
    ffGain: 100 / 200, // demand (m³/h) → van % (FEED_MAX 200)
    outTag: 'WTP_FEED_CV_01',
  },
];

export const waterLoopSeeds: Readonly<Record<string, number>> = {
  'tank-level': 50, // WTP_FEED_CV_01 (%) — điểm vận hành ~demand 100 m³/h
};
