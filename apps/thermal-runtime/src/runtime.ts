// apps/thermal-runtime — composition root: BoilerIslandModel + 7-loop CCS + Alarm Engine ISA-18.2,
// khép kín với ĐỒNG HỒ SIM tiến theo dt (Time Service, không Date.now trong vòng process).
// Sim→control→alarm→tag không dùng Math.random. App tổ hợp import engines/kernel/plugin; plugin
// runtime vẫn chỉ import @idtp/sdk.
import { SimulationHost, TagRealtimeEngine, ControlLoopEngine, AlarmEngine, MemoryHistorian, KpiEngine, historianKpiInput, MaintenanceEngine, FaceplateEngine, NavigationEngine, generateRegistry, generateScreens, generateControlLoops } from '@idtp/engines';
import type { AlarmKpi, FaceplateResolvers, FaceplateOverview, FaceplateAlarmRow, FaceplateDetail } from '@idtp/engines';
import { TimeService } from '@idtp/kernel';
import {
  BoilerIslandModel,
  boilerControlLoops,
  boilerLoopSeeds,
  boilerAlarms,
  boilerScreens,
  screenTags,
  thermalKpis,
  thermalMaintenance,
  thermalFaceplates,
  thermalNav,
  thermalSeedSpec,
} from '@idtp/plugin-thermal-power-600';
import type {
  IMalfunction,
  LoopMode,
  Quality,
  AlarmEvent,
  ISimSnapshot,
  IKpiResult,
  EquipmentRuntime,
  WorkOrder,
  WorkOrderStatus,
  FaceplateDef,
  NavNode,
  ScanClass,
  TagRecord,
} from '@idtp/sdk';

/** Số liệu roll-up registry (doc 07 §4) — phục vụ giám sát quy mô §10 trên HMI. */
export interface RegistrySummary {
  tags: number;
  alarms: number;
  screens: number; // màn hình danh mục sinh từ registry (doc 12, §10 ≥ 70)
  loops: number; // control loop danh mục (doc 09, §10 ≥ 25) — chưa gồm 7 loop CCS live
  byCell: Record<string, number>;
  byScanClass: Record<ScanClass, number>;
}

/** Dữ liệu 4 tab faceplate đã ráp (Trend trả thống kê min/max/last theo tag). */
export interface FaceplateData {
  def: FaceplateDef;
  overview: FaceplateOverview;
  alarms: FaceplateAlarmRow[];
  detail: FaceplateDetail;
}
export type FaceplateTrend = Record<string, { min: number; max: number; last: number }>;

/** Ảnh chụp OTS: trạng thái model + tag chính + số bước — để freeze/restore huấn luyện (doc 05-05). */
export interface OtsSnapshot {
  sim: ReadonlyMap<string, ISimSnapshot>;
  tags: Record<string, number>;
  step: number;
}

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
  freeze(on: boolean): void;
  isFrozen(): boolean;
  snapshot(): OtsSnapshot;
  restore(snap: OtsSnapshot): void;
  computeKpis(): Promise<IKpiResult[]>;
  maintenanceRuntime(): ReadonlyArray<EquipmentRuntime>;
  maintenanceMtbf(assetId: string): number;
  workOrders(): ReadonlyArray<WorkOrder>;
  createWorkOrder(assetId: string, type: 'PM' | 'CM', reason: string, user: string): WorkOrder;
  updateWorkOrder(woId: string, status: WorkOrderStatus, user: string): WorkOrder | { error: string };
  faceplateList(): ReadonlyArray<{ faceplateId: string; assetId: string; title: { vi: string; en: string }; pvTag: string }>;
  faceplateData(assetId: string): FaceplateData | undefined;
  faceplateTrend(assetId: string, hours: number): Promise<FaceplateTrend>;
  navTree(): ReadonlyArray<NavNode>;
  navAlarmIndex(): Record<string, string>;
  navHome(): string;
  navBreadcrumb(screenId: string): ReadonlyArray<NavNode>;
  registrySummary(): RegistrySummary;
  registryTag(name: string): TagRecord | undefined;
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

  // Maintenance: tích giờ chạy từ run-tag; MTBF lấy alarm P1 làm event hỏng của UNIT1.
  const maintenance = new MaintenanceEngine(thermalMaintenance, { formatTs: (ms) => time.formatEpoch(ms) });
  alarms.onTransition((e) => {
    if (e.state === 'UnackAlarm' && e.priority === 'P1') maintenance.recordFailure('UNIT1', nowMs());
  });

  // Faceplate: ráp 4 tab từ Tag/Loop/Alarm/Maintenance; Trend từ Historian.
  const faceplateEngine = new FaceplateEngine(thermalFaceplates);
  const alarmDefById = new Map(boilerAlarms.map((a) => [a.alarmId, a] as const));
  const faceplateResolvers: FaceplateResolvers = {
    read: (t) => {
      const v = tag.getCurrent(t);
      return v && typeof v.value === 'number' ? { value: v.value, quality: v.quality } : undefined;
    },
    loopMode: (id) => loops.getMode(id),
    loopOutput: (id) => loops.getOutput(id),
    alarmDef: (id) => {
      const a = alarmDefById.get(id);
      return a ? { priority: a.priority, condition: a.condition, setpoint: a.setpoint } : undefined;
    },
    activeAlarmIds: () => new Set(alarms.getActive().map((e) => e.alarmId)),
    runtime: (assetId) => {
      const r = maintenance.allRuntime().find((x) => x.assetId === assetId);
      return r ? { runningHours: r.runningHours, startCount: r.startCount } : undefined;
    },
    blockedReason: () => null, // interlock model để pha sau; lệnh bị chặn hiện qua Control/Security
  };

  // Navigation: cây điều hướng khai báo + index alarm→D3 (từ tag của alarm & tag màn hình hiển thị).
  const nav = new NavigationEngine(thermalNav, { alarms: boilerAlarms, screens: boilerScreens });

  // Registry §10: expand spec seed khai báo của plugin (≥ 3.000 tag / ≥ 600 alarm) bằng engine
  // generic — chứng minh nền tảng chịu quy mô thật. Là DANH MỤC (catalog); vòng process live chỉ
  // chạy lõi Boiler Island đã mô phỏng (17 tag sim), không nạp cả registry vào TagRealtimeEngine.
  const registry = generateRegistry(thermalSeedSpec);
  const registryByName = new Map(registry.tags.map((t) => [t.name, t] as const));
  const catalogScreens = generateScreens(registry, thermalSeedSpec.instances); // ≥ 70 màn hình (doc 12)
  const catalogLoops = generateControlLoops(registry); // ≥ 25 control loop (doc 09)

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

  // OTS: freeze (dừng toàn bộ vòng) + snapshot/restore (SimulationHost + tag chính).
  let frozen = false;
  const captureTags = [
    ...new Set([
      ...recordedTags,
      'BLR_FUEL_DEMAND_01',
      'BLR_FD_DAMPER_01',
      'BLR_ID_VANE_01',
      'BLR_SH_SPRAY_CV_01',
      'BLR_FW_CV_01',
      'BLR_TURBINE_DEMAND_01',
      'BLR_FIRING_DEMAND',
      'BLR_MW_DEMAND',
    ]),
  ];

  const step = (): void => {
    if (frozen) return; // OTS freeze: đóng băng sim + control + alarm + đồng hồ
    advance();
    evalAlarms();
    record();
    maintenance.sample((id) => num(id), nowMs());
  };

  return {
    step,
    tag,
    alarms,
    historian,
    recordedTags: () => recordedTags,
    freeze: (on) => {
      frozen = on;
      host.freeze(on);
    },
    isFrozen: () => frozen,
    snapshot: () => {
      const tags: Record<string, number> = {};
      for (const t of captureTags) tags[t] = num(t);
      return { sim: host.snapshotAll(), tags, step: stepCount };
    },
    restore: (snap) => {
      host.restoreAll(snap.sim);
      const ts = nowIso();
      tag.ingest(Object.entries(snap.tags).map(([id, value]) => ({ tagId: id, value, quality: GOOD, ts })));
      stepCount = snap.step;
    },
    setLoadDemand: (mw) => put('BLR_MW_DEMAND', mw),
    injectMalfunction: (m) => host.inject(model.id, m),
    clearMalfunction: (id) => host.clear(model.id, id),
    setLoopMode: (loopId, mode) => loops.setMode(loopId, mode),
    ackAlarm: (alarmId, user) => alarms.ack(alarmId, user, nowMs()),
    activeAlarms: () => alarms.getActive(),
    alarmKpi: () => alarms.kpi(nowMs()),
    computeKpis: () => {
      const r = historian.dataRange();
      return r ? new KpiEngine(thermalKpis).computeAll(historianKpiInput(historian, r.from, r.to)) : Promise.resolve([]);
    },
    maintenanceRuntime: () => maintenance.allRuntime(),
    maintenanceMtbf: (assetId) => maintenance.mtbf(assetId),
    workOrders: () => maintenance.workOrders(),
    createWorkOrder: (assetId, type, reason, user) => maintenance.createWorkOrder({ assetId, type, reason }, user, nowMs()),
    updateWorkOrder: (woId, status, user) => maintenance.updateWorkOrder(woId, status, user, nowMs()),
    faceplateList: () => faceplateEngine.list().map((d) => ({ faceplateId: d.faceplateId, assetId: d.assetId, title: d.title, pvTag: d.pvTag })),
    faceplateData: (assetId) => {
      const def = faceplateEngine.open(assetId);
      if (!def) return undefined;
      return {
        def,
        overview: faceplateEngine.overview(def, faceplateResolvers),
        alarms: faceplateEngine.alarms(def, faceplateResolvers),
        detail: faceplateEngine.detail(def, faceplateResolvers),
      };
    },
    faceplateTrend: async (assetId, hours) => {
      const out: FaceplateTrend = {};
      const def = faceplateEngine.open(assetId);
      const range = historian.dataRange();
      if (!def || !range) return out;
      const toMs = Date.parse(range.to);
      const fromMs = Math.max(Date.parse(range.from), toMs - hours * 3_600_000);
      const from = time.formatEpoch(fromMs);
      const span = Math.max(1, toMs - fromMs) + 1;
      for (const t of def.trendTags ?? []) {
        const [mn] = await historian.query(t, from, range.to, 'min', span);
        const [mx] = await historian.query(t, from, range.to, 'max', span);
        const [lastPt] = await historian.query(t, from, range.to, 'last', span);
        out[t] = { min: mn?.value ?? 0, max: mx?.value ?? 0, last: lastPt?.value ?? 0 };
      }
      return out;
    },
    navTree: () => nav.tree(),
    navAlarmIndex: () => nav.alarmIndex(),
    navHome: () => nav.home(),
    navBreadcrumb: (screenId) => nav.breadcrumb(screenId),
    registrySummary: () => ({
      tags: registry.tags.length,
      alarms: registry.alarms.length,
      screens: catalogScreens.length,
      loops: catalogLoops.length,
      byCell: registry.byCell,
      byScanClass: registry.byScanClass,
    }),
    registryTag: (name) => registryByName.get(name),
    value: (id) => num(id),
    nowIso,
  };
}
