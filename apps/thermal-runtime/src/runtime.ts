// apps/thermal-runtime — composition root: BoilerIslandModel + 7-loop CCS + Alarm Engine ISA-18.2,
// khép kín với ĐỒNG HỒ SIM tiến theo dt (Time Service, không Date.now trong vòng process).
// Sim→control→alarm→tag không dùng Math.random. App tổ hợp import engines/kernel/plugin; plugin
// runtime vẫn chỉ import @idtp/sdk.
import { SimulationHost, TagRealtimeEngine, ControlLoopEngine, AlarmEngine, MemoryHistorian } from '@idtp/engines';
import type { AlarmKpi } from '@idtp/engines';
import { TimeService } from '@idtp/kernel';
import {
  BoilerIslandModel,
  boilerControlLoops,
  boilerLoopSeeds,
  boilerAlarms,
  boilerScreens,
  screenTags,
} from '@idtp/plugin-thermal-power-600';
import type { IMalfunction, LoopMode, Quality, AlarmEvent } from '@idtp/sdk';

const REC_EVERY = 5; // ghi historian mỗi 5 bước (~2 Hz) — raw layer (doc 05-04)
const SNAPSHOT_EVERY = 3000; // snapshot toàn tag mỗi 3000 bước = 5 phút

const GOOD: Quality = 'Good';
const DEFAULT_MW = 448; // ~1500 t/h hơi
const DT_MS = 100;
const START_EPOCH_MS = Date.parse('2026-07-24T03:00:00.000Z'); // = 10:00:00 +07:00

export interface ThermalRuntimeOptions {
  loadMw?: number;
  warmupSteps?: number;
}

export interface ThermalRuntime {
  step(): void;
  setLoadDemand(mw: number): void;
  injectMalfunction(m: IMalfunction): void;
  clearMalfunction(id: string): void;
  setLoopMode(loopId: string, mode: LoopMode): void;
  ackAlarm(alarmId: string, user: string): AlarmEvent;
  activeAlarms(): ReadonlyArray<AlarmEvent>;
  alarmKpi(): AlarmKpi;
  value(tagId: string): number;
  nowIso(): string;
  recordedTags(): ReadonlyArray<string>;
  tag: TagRealtimeEngine;
  alarms: AlarmEngine;
  historian: MemoryHistorian;
}

export function createThermalRuntime(opts: ThermalRuntimeOptions = {}): ThermalRuntime {
  const loadMw = opts.loadMw ?? DEFAULT_MW;
  const warmupSteps = opts.warmupSteps ?? 2000;

  const time = new TimeService({ offset: '+07:00' });
  let stepCount = 0;
  const nowMs = (): number => START_EPOCH_MS + stepCount * DT_MS;
  const nowIso = (): string => time.formatEpoch(nowMs());

  const tag = new TagRealtimeEngine();
  const num = (id: string, def = 0): number => {
    const v = tag.getCurrent(id);
    return typeof v?.value === 'number' ? v.value : def;
  };
  const put = (id: string, value: number): void => tag.ingest([{ tagId: id, value, quality: GOOD, ts: nowIso() }]);

  // Lệnh tải + seed OP điểm vận hành.
  put('BLR_MW_DEMAND', loadMw);
  put('BLR_TURBINE_DEMAND_01', boilerLoopSeeds.governor ?? 1500);
  put('BLR_FIRING_DEMAND', boilerLoopSeeds['boiler-master-pressure'] ?? 0);
  put('BLR_FUEL_DEMAND_01', boilerLoopSeeds['fuel-master'] ?? 0);
  put('BLR_FD_DAMPER_01', boilerLoopSeeds['air-o2-trim'] ?? 0);
  put('BLR_ID_VANE_01', boilerLoopSeeds['furnace-draft'] ?? 0);
  put('BLR_SH_SPRAY_CV_01', boilerLoopSeeds['sh-temp'] ?? 0);
  put('BLR_FW_CV_01', boilerLoopSeeds['drum-level'] ?? 0);

  const host = new SimulationHost(DT_MS, {
    now: () => nowIso(),
    getTag: (id) => num(id),
    onOutputs: (outs) =>
      tag.ingest(outs.map((o) => ({ tagId: o.tagId, value: o.value, quality: o.quality, ts: nowIso() }))),
  });
  const model = new BoilerIslandModel();
  host.register(model, { warmStart: { coalFlow: 211, steamGen: 1500, pressure: 17.5, o2: 3.2, shTemp: 541 } });

  const loops = new ControlLoopEngine(boilerControlLoops);
  const ingestOut = (): void => {
    const outs = loops.step({ getTag: (id) => num(id) }, DT_MS / 1000);
    tag.ingest(outs.map((o) => ({ tagId: o.outTag, value: o.value, quality: GOOD, ts: nowIso() })));
  };

  // Alarm Engine ISA-18.2 nạp alarm khai báo của plugin. Suppression theo trạng thái tổ máy.
  const unitState: Record<string, string> = { unit_state: 'RUNNING' };
  const alarms = new AlarmEngine(boilerAlarms, { formatTs: (ms) => time.formatEpoch(ms) });
  alarms.setSuppressionEvaluator((expr) => {
    const parts = expr.split('==').map((s) => s.trim());
    const k = parts[0];
    const v = parts[1];
    return k !== undefined && v !== undefined && unitState[k] === v;
  });
  const alarmTags = [...new Set(boilerAlarms.map((a) => a.tagId))];
  const evalAlarms = (): void => {
    for (const t of alarmTags) {
      const cur = tag.getCurrent(t);
      if (cur && typeof cur.value === 'number') alarms.evaluate(t, cur.value, cur.quality, nowMs());
    }
  };

  // Historian (adapter memory): ghi tag hiển thị + tag alarm để truy vấn lịch sử + DATA REPLAY.
  const historian = new MemoryHistorian({ formatTs: (ms) => time.formatEpoch(ms) });
  const recordedTags = [...new Set([...boilerScreens.flatMap((s) => screenTags(s)), ...alarmTags])];
  const record = (): void => {
    if (stepCount % REC_EVERY === 0) {
      const ts = nowIso();
      historian.write(recordedTags.map((t) => ({ tagId: t, value: num(t), quality: GOOD, ts })));
    }
    if (stepCount % SNAPSHOT_EVERY === 0) void historian.snapshot(nowIso());
  };

  const advance = (): void => {
    stepCount += 1;
    host.step(); // sim đọc OP → ghi PV
    ingestOut(); // loop đọc PV → ghi OP
  };

  // Warmup: giữ loop ở MAN (OP = seed) cho sim về điểm vận hành.
  for (const [loopId, seed] of Object.entries(boilerLoopSeeds)) {
    loops.setMode(loopId, 'MAN');
    loops.setManualOutput(loopId, seed);
  }
  for (let i = 0; i < warmupSteps; i++) advance();
  for (const loopId of Object.keys(boilerLoopSeeds)) loops.setMode(loopId, 'AUTO');

  const step = (): void => {
    advance();
    evalAlarms();
    record();
  };

  return {
    step,
    tag,
    alarms,
    historian,
    recordedTags: () => recordedTags,
    setLoadDemand: (mw) => put('BLR_MW_DEMAND', mw),
    injectMalfunction: (m) => host.inject(model.id, m),
    clearMalfunction: (id) => host.clear(model.id, id),
    setLoopMode: (loopId, mode) => loops.setMode(loopId, mode),
    ackAlarm: (alarmId, user) => alarms.ack(alarmId, user, nowMs()),
    activeAlarms: () => alarms.getActive(),
    alarmKpi: () => alarms.kpi(nowMs()),
    value: (id) => num(id),
    nowIso,
  };
}
