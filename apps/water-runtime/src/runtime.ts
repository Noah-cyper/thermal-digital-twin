// apps/water-runtime — composition root cho PLUGIN #2 (water-treatment-demo). Chứng minh "mọi nhà máy chỉ
// là plugin": app này tổ hợp WaterTankModel + RoMembraneModel + control loop + AlarmEngine trên ĐÚNG engine
// chung (@idtp/engines) mà thermal-runtime dùng — 0 dòng kernel/engine riêng cho nước. Plugin runtime chỉ
// import @idtp/sdk; app tổ hợp được phép import engines + plugin. Đồng hồ sim tiến theo dt (không Date.now).
import { SimulationHost, TagRealtimeEngine, ControlLoopEngine, AlarmEngine } from '@idtp/engines';
import type { AlarmEvent } from '@idtp/sdk';
import {
  WaterTankModel,
  RoMembraneModel,
  waterControlLoops,
  waterLoopSeeds,
  waterAlarms,
  waterScreens,
} from '@idtp/plugin-water-treatment-demo';
import type { IMalfunction, Quality, ScreenDef } from '@idtp/sdk';

const GOOD: Quality = 'Good';
const DT_MS = 100;
const START_EPOCH_MS = Date.parse('2026-07-24T03:00:00.000Z');

// Tag phát lên HMI (bể + màng RO).
export const WATER_TAGS = [
  'WTP_TANK_LEVEL_01', 'WTP_FEED_FLOW_01', 'WTP_OUT_FLOW_01', 'WTP_PUMP_A_RUN', 'WTP_DEMAND_01', 'WTP_FEED_CV_01',
  'WTP_RO_PERMEATE_FLOW_01', 'WTP_RO_REJECT_FLOW_01', 'WTP_RO_RECOVERY_01', 'WTP_RO_DP_01',
  'WTP_RO_SALT_REJECT_01', 'WTP_RO_PERM_COND_01', 'WTP_RO_HEALTHY_01',
];
const ALARM_TAGS = ['WTP_TANK_LEVEL_01', 'WTP_FEED_FLOW_01', 'WTP_PUMP_A_RUN', 'WTP_DEMAND_01', 'WTP_OUT_FLOW_01', 'WTP_RO_PERM_COND_01', 'WTP_RO_DP_01'];

export interface WaterRuntime {
  step(): void;
  value(tagId: string): number;
  setDemand(m3h: number): void;
  injectMalfunction(m: IMalfunction): void;
  clearMalfunction(id: string): void;
  activeAlarms(): ReadonlyArray<AlarmEvent>;
  screens(): ReadonlyArray<ScreenDef>;
}

export function createWaterRuntime(opts: { warmupSteps?: number } = {}): WaterRuntime {
  const warmupSteps = opts.warmupSteps ?? 5000; // loop mức bể hội tụ chậm (đủ để về SP 60% trước khi phục vụ)
  const tag = new TagRealtimeEngine();
  let stepCount = 0;
  const nowMs = (): number => START_EPOCH_MS + stepCount * DT_MS;
  const nowIso = (): string => new Date(nowMs()).toISOString();
  const num = (id: string, def = 0): number => {
    const v = tag.getCurrent(id);
    return typeof v?.value === 'number' ? v.value : def;
  };
  const put = (id: string, value: number): void => tag.ingest([{ tagId: id, value, quality: GOOD, ts: nowIso() }]);

  // Seed đầu vào: nhu cầu nước ra + van cấp (khởi động từ seed loop mức bể).
  put('WTP_DEMAND_01', 100);
  put('WTP_FEED_CV_01', waterLoopSeeds['tank-level'] ?? 50);

  const host = new SimulationHost(DT_MS, {
    now: () => nowIso(),
    getTag: (id) => num(id),
    onOutputs: (outs) => tag.ingest(outs.map((o) => ({ tagId: o.tagId, value: o.value, quality: o.quality, ts: nowIso() }))),
  });
  const tank = new WaterTankModel();
  host.register(tank);
  const ro = new RoMembraneModel(); // đọc WTP_FEED_FLOW_01 (từ bể) → permeate/reject
  host.register(ro);

  const loops = new ControlLoopEngine(waterControlLoops);
  const alarms = new AlarmEngine(waterAlarms, { formatTs: (ms) => new Date(ms).toISOString() });

  const advance = (): void => {
    stepCount += 1;
    host.step();
    for (const o of loops.step({ getTag: num }, DT_MS / 1000)) put(o.outTag, o.value);
  };

  // Warmup để mức bể hội tụ về setpoint trước khi phục vụ.
  for (let i = 0; i < warmupSteps; i++) advance();

  const step = (): void => {
    advance();
    for (const t of ALARM_TAGS) alarms.evaluate(t, num(t), 'Good', nowMs());
  };

  return {
    step,
    value: (id) => num(id),
    setDemand: (m3h) => put('WTP_DEMAND_01', m3h),
    injectMalfunction: (m) => host.injectAll(m),
    clearMalfunction: (id) => host.clearAll(id),
    activeAlarms: () => alarms.getActive(),
    screens: () => waterScreens,
  };
}
