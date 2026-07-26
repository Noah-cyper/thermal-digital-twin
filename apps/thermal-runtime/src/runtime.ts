// apps/thermal-runtime — composition root Pha B: đóng 7 control loop (khai báo trong plugin) quanh
// BoilerIslandModel thành CCS coordinated control khép kín. App tổ hợp được phép import engines +
// plugin; plugin runtime vẫn chỉ import @idtp/sdk. Sim→control→tag không dùng Math.random.
import { SimulationHost, TagRealtimeEngine, ControlLoopEngine } from '@idtp/engines';
import {
  BoilerIslandModel,
  boilerControlLoops,
  boilerLoopSeeds,
} from '@idtp/plugin-thermal-power-600';
import type { IMalfunction, LoopMode, Quality } from '@idtp/sdk';

const TS = '2026-07-24T10:00:00+07:00';
const GOOD: Quality = 'Good';
const DEFAULT_MW = 448; // ~1500 t/h hơi

export interface ThermalRuntimeOptions {
  loadMw?: number;
  warmupSteps?: number; // số bước MAN giữ OP tại seed để sim về điểm vận hành trước khi AUTO
}

export interface ThermalRuntime {
  step(): void;
  setLoadDemand(mw: number): void;
  injectMalfunction(m: IMalfunction): void;
  clearMalfunction(id: string): void;
  setLoopMode(loopId: string, mode: LoopMode): void;
  value(tagId: string): number;
  tag: TagRealtimeEngine;
}

export function createThermalRuntime(opts: ThermalRuntimeOptions = {}): ThermalRuntime {
  const loadMw = opts.loadMw ?? DEFAULT_MW;
  const warmupSteps = opts.warmupSteps ?? 2000;

  const tag = new TagRealtimeEngine();
  const num = (id: string, def = 0): number => {
    const v = tag.getCurrent(id);
    return typeof v?.value === 'number' ? v.value : def;
  };
  const put = (id: string, value: number): void =>
    tag.ingest([{ tagId: id, value, quality: GOOD, ts: TS }]);

  // Lệnh tải + seed OP tại điểm vận hành (sim khởi động gần cân bằng).
  put('BLR_MW_DEMAND', loadMw);
  put('BLR_TURBINE_DEMAND_01', boilerLoopSeeds.governor ?? 1500);
  put('BLR_FIRING_DEMAND', boilerLoopSeeds['boiler-master-pressure'] ?? 0);
  put('BLR_FUEL_DEMAND_01', boilerLoopSeeds['fuel-master'] ?? 0);
  put('BLR_FD_DAMPER_01', boilerLoopSeeds['air-o2-trim'] ?? 0);
  put('BLR_ID_VANE_01', boilerLoopSeeds['furnace-draft'] ?? 0);
  put('BLR_SH_SPRAY_CV_01', boilerLoopSeeds['sh-temp'] ?? 0);
  put('BLR_FW_CV_01', boilerLoopSeeds['drum-level'] ?? 0);

  const host = new SimulationHost(100, {
    now: () => TS,
    getTag: (id) => num(id),
    onOutputs: (outs) =>
      tag.ingest(outs.map((o) => ({ tagId: o.tagId, value: o.value, quality: o.quality, ts: TS }))),
  });
  const model = new BoilerIslandModel();
  // Warm-start tại điểm vận hành ~448 MW (steam ~1500 t/h) để bỏ transient khởi động nguội.
  host.register(model, { warmStart: { coalFlow: 211, steamGen: 1500, pressure: 17.5, o2: 3.2, shTemp: 541 } });

  const loops = new ControlLoopEngine(boilerControlLoops);
  const ingestOut = (): void => {
    const outs = loops.step({ getTag: (id) => num(id) }, 0.1);
    tag.ingest(outs.map((o) => ({ tagId: o.outTag, value: o.value, quality: GOOD, ts: TS })));
  };

  // Warmup: giữ loop ở MAN (OP = seed) cho sim về điểm vận hành; step() vẫn ghi lastFf cho bumpless.
  for (const [loopId, seed] of Object.entries(boilerLoopSeeds)) {
    loops.setMode(loopId, 'MAN');
    loops.setManualOutput(loopId, seed);
  }
  for (let i = 0; i < warmupSteps; i++) {
    host.step();
    ingestOut();
  }
  // Chuyển AUTO bumpless (integral = OP − FF gần nhất) → CCS coordinated điều tiết.
  for (const loopId of Object.keys(boilerLoopSeeds)) loops.setMode(loopId, 'AUTO');

  const step = (): void => {
    host.step(); // sim đọc OP → ghi PV
    ingestOut(); // loop đọc PV → ghi OP
  };

  return {
    step,
    tag,
    setLoadDemand: (mw) => put('BLR_MW_DEMAND', mw),
    injectMalfunction: (m) => host.inject(model.id, m),
    clearMalfunction: (id) => host.clear(model.id, id),
    setLoopMode: (loopId, mode) => loops.setMode(loopId, mode),
    value: (id) => num(id),
  };
}
