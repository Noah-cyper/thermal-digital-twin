// apps/thermal-runtime — composition root: BoilerIslandModel + 7-loop CCS + Alarm Engine ISA-18.2,
// khép kín với ĐỒNG HỒ SIM tiến theo dt (Time Service, không Date.now trong vòng process).
// Sim→control→alarm→tag không dùng Math.random. App tổ hợp import engines/kernel/plugin; plugin
// runtime vẫn chỉ import @idtp/sdk.
import { SimulationHost, TagRealtimeEngine, ControlLoopEngine, AlarmEngine, MemoryHistorian, KpiEngine, historianKpiInput, MaintenanceEngine, FaceplateEngine, NavigationEngine, generateRegistry, generateScreens, generateControlLoops, SequenceEngine, executeScenario, CauseEffectEngine, AiAdvisor, PredictiveMaintenance, RegistrySimModel, ReportEngine, EventJournal } from '@idtp/engines';
import type { AlarmKpi, FaceplateResolvers, FaceplateOverview, FaceplateAlarmRow, FaceplateDetail, Advice, Report, JournalEntry, JournalQuery, JournalSummary, JournalCategory, JournalSeverity } from '@idtp/engines';
import { TimeService } from '@idtp/kernel';
import {
  BoilerIslandModel,
  TurbineGeneratorModel,
  ReheatCycleModel,
  FeedwaterTrainModel,
  CondenserCWModel,
  FlueGasAirModel,
  EmissionsModel,
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
  thermalSequences,
  thermalScenarios,
  thermalCauseEffect,
  thermalKnowledge,
  thermalPredictiveRules,
  thermalReportSections,
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
  SeqRunState,
  ScenarioPhaseResult,
  CauseEffectMatrix,
  CeState,
  PredictiveAdvisory,
  ScreenDef,
  IReportContext,
} from '@idtp/sdk';

/** Tuỳ chọn & kết quả RE-SIMULATION what-if (doc 05-05 §4) — nhánh mô phỏng độc lập từ snapshot live. */
export interface ReSimOptions {
  overrides?: Record<string, number>; // ghi đè tag đầu vào ở nhánh (vd BLR_MW_DEMAND)
  malfunction?: string; // tiêm malfunction vào NHÁNH (không đụng live)
  steps?: number; // số bước sim (mặc định 600)
  sampleTags?: ReadonlyArray<string>; // tag chụp theo quỹ đạo
  everyN?: number; // chu kỳ chụp (mặc định 50 bước)
}
export interface ReSimResult {
  steps: number;
  trajectory: Array<{ step: number; tags: Record<string, number> }>;
}

/** Số liệu roll-up registry (doc 07 §4) — phục vụ giám sát quy mô §10 trên HMI. */
export interface RegistrySummary {
  tags: number;
  alarms: number;
  screens: number; // màn hình danh mục sinh từ registry (doc 12, §10 ≥ 70)
  loops: number; // control loop danh mục (doc 09, §10 ≥ 25) — chưa gồm 7 loop CCS live
  sequences: number; // chuỗi SFC khai báo (doc 09, §10: 8 sequence)
  scenarios: number; // kịch bản vận hành (doc 22, §10: cold-start→coast-down)
  ceMatrices: number; // ma trận cause&effect (doc 09 §4: MFT + turbine trip)
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
  breadthLive?: boolean; // sinh giá trị placeholder cho toàn bộ §10 catalog → cả nhà máy "sống"
}

/** Ảnh chẩn đoán hệ thống (màn hình hệ thống "System Diagnostic", ISA-101 S-class) — READ-ONLY, tự soi. */
export interface SystemDiagnostics {
  sim: { steps: number; frozen: boolean; clock: string };
  tags: { recorded: number; good: number; other: number; catalog: number };
  loops: { total: number; auto: number; man: number; cascade: number };
  historian: { points: number; from: string | null; to: string | null };
  alarms: { active: number; byPriority: Record<string, number> };
  journal: { total: number; lastSeq: number };
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
  reSimulate(opts?: ReSimOptions): ReSimResult;
  computeKpis(): Promise<IKpiResult[]>;
  generateReport(hours?: number): Promise<Report>;
  eventLog(opts?: JournalQuery): ReadonlyArray<JournalEntry>;
  eventSummary(): JournalSummary;
  logEvent(category: JournalCategory, severity: JournalSeverity, message: string, actor?: string, source?: string): JournalEntry;
  systemDiagnostics(): SystemDiagnostics;
  maintenanceRuntime(): ReadonlyArray<EquipmentRuntime>;
  maintenanceMtbf(assetId: string): number;
  evaluatePredictive(): PredictiveAdvisory[];
  predictiveAdvisories(): ReadonlyArray<PredictiveAdvisory>;
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
  catalogScreens(): ReadonlyArray<ScreenDef>;
  sequenceList(): ReadonlyArray<{ sequenceId: string; title: { vi: string; en: string }; steps: number }>;
  runSequenceToCompletion(sequenceId: string): SeqRunState;
  startLiveSequence(sequenceId: string): SeqRunState;
  liveSequenceState(): ReadonlyArray<{ sequenceId: string } & SeqRunState>;
  scenarioList(): ReadonlyArray<{ scenarioId: string; title: { vi: string; en: string }; phases: number }>;
  runScenario(scenarioId: string): ScenarioPhaseResult[];
  causeEffectMatrices(): ReadonlyArray<CauseEffectMatrix>;
  causeEffectState(matrixId: string): CeState | undefined;
  resetCauseEffect(matrixId: string): boolean;
  explainAlarm(alarmId: string): Advice | undefined;
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
  // Chiều sâu vật lý (v1.12): turbine/generator chạy CẠNH boiler — đăng ký SAU để đọc hơi/áp/MW tươi
  // mỗi bước. Additive: sinh thêm tag turbine/generator, không đổi GEN_MW_01.
  const turbine = new TurbineGeneratorModel();
  host.register(turbine);
  // Chu trình tái nhiệt + turbine nhiều tầng (v1.18): đăng ký SAU để đọc hơi/áp/nhiệt/MW tươi mỗi bước.
  // Additive — sinh thêm tag đường reheat + tách công suất HP/IP/LP, không đổi GEN_MW_01.
  const reheat = new ReheatCycleModel();
  host.register(reheat);
  // Đoàn gia nhiệt nước cấp hồi nhiệt + heat rate chu trình (v1.19): đăng ký SAU reheat để đọc nhiệt
  // reheater tươi. Additive — sinh thêm tag nước cấp/heat rate, không đổi tag boiler/turbine.
  const feedwater = new FeedwaterTrainModel();
  host.register(feedwater);
  // Bình ngưng + nước tuần hoàn (v1.20): đăng ký SAU feedwater để đọc heat rate chu trình tươi → cân
  // bằng năng lượng ra nhiệt thải + phía CW. Additive — chỉ đọc chân không, không ghi đè.
  const condenser = new CondenserCWModel();
  host.register(condenser);
  // Đường khói + gió cháy + hiệu suất lò (v1.21): đăng ký SAU feedwater để đọc heat rate chu trình tươi
  // → hiệu suất lò + đường khói-gió. Additive — không đổi tag boiler.
  const fluegas = new FlueGasAirModel();
  host.register(fluegas);
  // Phát thải CEMS (v1.22): đăng ký SAU fluegas để đọc lưu lượng khói/gió thừa tươi → bụi/SO₂/NOₓ/CO₂
  // sau ESP/FGD. Additive — chỉ đọc than/khói, không đổi tag khác.
  const emissions = new EmissionsModel();
  host.register(emissions);

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
  const recordedTags = [...new Set([...boilerScreens.flatMap((s) => screenTags(s)), ...alarmTags, ...turbine.tagsProvided, ...reheat.tagsProvided, ...feedwater.tagsProvided, ...condenser.tagsProvided, ...fluegas.tagsProvided, ...emissions.tagsProvided])];
  const record = (): void => {
    if (stepCount % REC_EVERY === 0) {
      const ts = nowIso();
      historian.write(recordedTags.map((t) => ({ tagId: t, value: num(t), quality: GOOD, ts })));
    }
    if (stepCount % SNAPSHOT_EVERY === 0) void historian.snapshot(nowIso());
  };

  // Event Journal / SOE (doc 15/18, màn hình hệ thống "Event Log" — ISA-101 S-class): nguồn nhật ký
  // HỢP NHẤT ghi lại sự kiện đã xảy ra (alarm/trip/lệnh/chuỗi/bảo mật/hệ thống). READ-ONLY với process —
  // chỉ quan sát & ghi, không đụng tag/setpoint. `logEvent` gắn dấu thời gian đồng hồ sim.
  const journal = new EventJournal();
  const logEvent = (category: JournalCategory, severity: JournalSeverity, message: string, actor?: string, source?: string): JournalEntry =>
    journal.record({ at: nowIso(), category, severity, message, actor, source });
  const alarmSev = (p: AlarmEvent['priority']): JournalSeverity => (p === 'P1' ? 'critical' : p === 'P2' ? 'warn' : 'info');
  const activeAlarmSet = new Set<string>(); // dedupe raised/cleared theo alarmId

  // Maintenance: tích giờ chạy từ run-tag; MTBF lấy alarm P1 làm event hỏng của UNIT1.
  const maintenance = new MaintenanceEngine(thermalMaintenance, { formatTs: (ms) => time.formatEpoch(ms) });
  alarms.onTransition((e) => {
    if (e.state === 'UnackAlarm' && e.priority === 'P1') maintenance.recordFailure('UNIT1', nowMs());
    // Nhật ký sự kiện: alarm mới (UnackAlarm) và trở về bình thường (Normal) — dedupe theo alarmId.
    if (e.state === 'UnackAlarm') {
      if (!activeAlarmSet.has(e.alarmId)) {
        activeAlarmSet.add(e.alarmId);
        logEvent('alarm', alarmSev(e.priority), `Alarm [${e.priority}] ${e.alarmId}${e.value !== undefined ? ` = ${Number(e.value).toFixed(1)}` : ''}`, undefined, e.alarmId);
      }
    } else if (e.state === 'Normal' && activeAlarmSet.delete(e.alarmId)) {
      logEvent('alarm', 'info', `Alarm hết: ${e.alarmId} trở lại bình thường`, undefined, e.alarmId);
    }
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

  // Chạy một SFC tới kết thúc bằng đồng hồ ảo (không đụng đồng hồ/CCS sim). Dùng cho SFC panel + kịch bản.
  const runSeqState = (sequenceId: string): SeqRunState => {
    const def = thermalSequences.find((s) => s.sequenceId === sequenceId);
    if (!def) return { status: 'failed', stepIndex: -1, stepId: null, message: `không có chuỗi '${sequenceId}'` };
    let vnow = nowMs();
    const eng = new SequenceEngine(def, {
      getTag: (id) => {
        const v = tag.getCurrent(id);
        return typeof v?.value === 'number' || typeof v?.value === 'boolean' ? v.value : 0;
      },
      command: (cmd) => put(cmd.tagId, typeof cmd.value === 'number' ? cmd.value : cmd.value ? 1 : 0),
      now: () => vnow,
    });
    eng.start();
    for (let i = 0; i < 5000 && eng.state().status === 'running'; i++) {
      vnow += DT_MS;
      eng.tick();
    }
    return eng.state();
  };

  // Cause & Effect (doc 09 §4): MFT + turbine trip. Đánh giá mỗi bước; hệ quả CHỐT ghi tag trip
  // (flag, không nối vào CCS ở v1 — actuation sâu để sau). Ở điểm vận hành mọi nguyên nhân bất hoạt.
  const ceEngines = thermalCauseEffect.map(
    (m) => new CauseEffectEngine(m, { command: (cmd) => put(cmd.tagId, typeof cmd.value === 'number' ? cmd.value : cmd.value ? 1 : 0) }),
  );
  const ceById = new Map(ceEngines.map((e) => [e.matrixId, e] as const));
  const loggedTrips = new Map<string, Set<string>>(); // matrixId → effect tags đã ghi nhật ký (dedupe)
  const evalCe = (): void => {
    for (const e of ceEngines) {
      e.evaluate((id) => num(id));
      const tripped = e.state().trippedEffects;
      let seen = loggedTrips.get(e.matrixId);
      if (seen === undefined) {
        seen = new Set<string>();
        loggedTrips.set(e.matrixId, seen);
      }
      if (tripped.length === 0) {
        seen.clear(); // matrix đã reset → cho phép ghi lại nếu trip lần sau
        continue;
      }
      for (const eff of tripped) {
        if (!seen.has(eff)) {
          seen.add(eff);
          logEvent('trip', 'critical', `TRIP [${e.matrixId}] hệ quả chốt: ${eff}`, undefined, e.matrixId);
        }
      }
    }
  };

  // AI Advisor v1 (rule-based, READ-ONLY): giải thích alarm từ tri thức plugin + ma trận C&E. Không
  // ghi tag/setpoint/ACK — chỉ đọc để trích dẫn (chống bịa).
  const advisor = new AiAdvisor({ alarms: boilerAlarms, matrices: thermalCauseEffect, knowledge: thermalKnowledge });

  // Predictive Maintenance v1 (rule-based, READ-ONLY): cảnh báo sớm từ ngưỡng/xu hướng/giờ chạy.
  const predictive = new PredictiveMaintenance(thermalPredictiveRules);
  let lastPredictive: PredictiveAdvisory[] = [];

  // Report Engine (doc 21): ráp báo cáo ca/ngày từ section khai báo của plugin, đọc từ Historian.
  const reportEngine = new ReportEngine(thermalReportSections);

  // Chuỗi SFC chạy "live" — tick theo nhịp sim (đồng hồ THẬT), ghi tag lệnh mà sim đọc mỗi bước →
  // SFC tác động PHYSICS qua thời gian (khác runSequenceToCompletion chạy đồng hồ ảo, không bước sim).
  const liveSeqs = new Map<string, SequenceEngine>();
  const liveSeqIo = {
    getTag: (id: string): number | boolean => {
      const v = tag.getCurrent(id);
      return typeof v?.value === 'number' || typeof v?.value === 'boolean' ? v.value : 0;
    },
    command: (cmd: { tagId: string; value: number | boolean }): void =>
      put(cmd.tagId, typeof cmd.value === 'number' ? cmd.value : cmd.value ? 1 : 0),
    now: (): number => nowMs(),
  };
  const tickLiveSeqs = (): void => {
    for (const [id, eng] of liveSeqs) {
      eng.tick();
      const st = eng.state();
      if (st.status !== 'running') {
        liveSeqs.delete(id);
        logEvent('sequence', st.status === 'done' ? 'info' : 'warn', `SFC '${id}' kết thúc: ${st.status}${st.message ? ` — ${st.message}` : ''}`, undefined, id);
      }
    }
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

  // Breadth "sống": sau warmup, đăng ký RegistrySimModel sinh giá trị placeholder cho toàn §10 catalog
  // (tách biệt tag sim thật của boiler/turbine) → mọi màn hình/tag breadth có dữ liệu. Opt-in (mặc định tắt).
  if (opts.breadthLive) host.register(new RegistrySimModel(registry.tags));

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
    evalCe();
    tickLiveSeqs();
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
      logEvent('system', 'warn', on ? 'OTS: FREEZE — đóng băng mô phỏng' : 'OTS: UNFREEZE — chạy tiếp');
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
    reSimulate: (opts = {}) => {
      const steps = opts.steps ?? 600;
      const everyN = opts.everyN ?? 50;
      const sampleTags = opts.sampleTags ?? ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'BLR_DRUM_LEVEL_01'];
      // Kho tag NHÁNH — seed từ giá trị live hiện tại; sim/tag LIVE không bị đụng (what-if độc lập).
      const branch = new Map<string, number>();
      for (const t of captureTags) branch.set(t, num(t));
      for (const [k, v] of Object.entries(opts.overrides ?? {})) branch.set(k, v);
      const bnum = (id: string): number => branch.get(id) ?? 0;
      const bput = (id: string, v: number): void => void branch.set(id, v);
      // Sim nhánh (host + model) khôi phục từ SNAPSHOT live → nhánh khởi đầu = trạng thái live.
      const bModel = new BoilerIslandModel();
      const bHost = new SimulationHost(DT_MS, {
        now: () => nowIso(),
        getTag: bnum,
        onOutputs: (outs) => {
          for (const o of outs) bput(o.tagId, o.value);
        },
      });
      bHost.register(bModel);
      bHost.restoreAll(host.snapshotAll());
      if (opts.malfunction) bHost.inject(bModel.id, { id: opts.malfunction });
      // CCS chạy trong nhánh (loop độc lập, AUTO).
      const bLoops = new ControlLoopEngine(boilerControlLoops);
      for (const id of Object.keys(boilerLoopSeeds)) bLoops.setMode(id, 'AUTO');
      const trajectory: Array<{ step: number; tags: Record<string, number> }> = [];
      for (let i = 1; i <= steps; i++) {
        bHost.step();
        const outs = bLoops.step({ getTag: bnum }, DT_MS / 1000);
        for (const o of outs) bput(o.outTag, o.value);
        if (i % everyN === 0) {
          const snap: Record<string, number> = {};
          for (const t of sampleTags) snap[t] = bnum(t);
          trajectory.push({ step: i, tags: snap });
        }
      }
      return { steps, trajectory };
    },
    setLoadDemand: (mw) => {
      put('BLR_MW_DEMAND', mw);
      logEvent('command', 'info', `Đặt tải: BLR_MW_DEMAND = ${mw} MW`, undefined, 'BLR_MW_DEMAND');
    },
    injectMalfunction: (m) => {
      host.inject(model.id, m);
      logEvent('system', 'warn', `Tiêm malfunction (OTS): ${m.id}`, undefined, m.id);
    },
    clearMalfunction: (id) => {
      host.clear(model.id, id);
      logEvent('system', 'info', `Gỡ malfunction (OTS): ${id}`, undefined, id);
    },
    setLoopMode: (loopId, mode) => {
      loops.setMode(loopId, mode);
      logEvent('command', 'info', `Đổi mode loop '${loopId}' → ${mode}`, undefined, loopId);
    },
    ackAlarm: (alarmId, user) => {
      const ev = alarms.ack(alarmId, user, nowMs());
      logEvent('command', 'info', `ACK alarm ${alarmId}`, user, alarmId);
      return ev;
    },
    activeAlarms: () => alarms.getActive(),
    alarmKpi: () => alarms.kpi(nowMs()),
    computeKpis: () => {
      const r = historian.dataRange();
      return r ? new KpiEngine(thermalKpis).computeAll(historianKpiInput(historian, r.from, r.to)) : Promise.resolve([]);
    },
    generateReport: async (hours = 8) => {
      const title = { vi: 'Báo cáo vận hành', en: 'Operations Report' };
      const range = historian.dataRange();
      if (!range) return { title, from: '', to: '', sections: [] };
      const toMs = Date.parse(range.to);
      const fromMs = Math.max(Date.parse(range.from), toMs - hours * 3_600_000);
      const from = time.formatEpoch(fromMs);
      const span = Math.max(1, toMs - fromMs) + 1;
      const ctx: IReportContext = {
        range: { from, to: range.to },
        read: async (tag, agg) => {
          const [p] = await historian.query(tag, from, range.to, agg, span);
          return p?.value ?? 0;
        },
      };
      return reportEngine.generate(ctx, title);
    },
    eventLog: (opts) => journal.query(opts),
    eventSummary: () => journal.summary(),
    logEvent: (category, severity, message, actor, source) => logEvent(category, severity, message, actor, source),
    systemDiagnostics: () => {
      // Chẩn đoán tự soi READ-ONLY: mọi số lấy từ nguồn thật của runtime (không bịa).
      let good = 0;
      let other = 0;
      for (const t of recordedTags) {
        const v = tag.getCurrent(t);
        if (v && v.quality === 'Good' && typeof v.value === 'number') good += 1;
        else other += 1;
      }
      let auto = 0;
      let man = 0;
      let cascade = 0;
      const loopIds = Object.keys(boilerLoopSeeds);
      for (const id of loopIds) {
        const mode = loops.getMode(id);
        if (mode === 'AUTO') auto += 1;
        else if (mode === 'CASCADE') cascade += 1;
        else man += 1;
      }
      const byPriority: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
      const active = alarms.getActive();
      for (const a of active) byPriority[a.priority] = (byPriority[a.priority] ?? 0) + 1;
      const range = historian.dataRange();
      return {
        sim: { steps: stepCount, frozen, clock: nowIso() },
        tags: { recorded: recordedTags.length, good, other, catalog: registry.tags.length },
        loops: { total: loopIds.length, auto, man, cascade },
        historian: { points: historian.size(), from: range?.from ?? null, to: range?.to ?? null },
        alarms: { active: active.length, byPriority },
        journal: { total: journal.summary().total, lastSeq: journal.lastSeq },
      };
    },
    maintenanceRuntime: () => maintenance.allRuntime(),
    maintenanceMtbf: (assetId) => maintenance.mtbf(assetId),
    evaluatePredictive: () => {
      lastPredictive = predictive.evaluate({
        nowMs: nowMs(),
        getTag: (id) => num(id),
        runningHours: (a) => maintenance.allRuntime().find((x) => x.assetId === a)?.runningHours ?? 0,
      });
      return lastPredictive;
    },
    predictiveAdvisories: () => lastPredictive,
    workOrders: () => maintenance.workOrders(),
    createWorkOrder: (assetId, type, reason, user) => {
      const wo = maintenance.createWorkOrder({ assetId, type, reason }, user, nowMs());
      logEvent('command', 'info', `Tạo lệnh công việc ${type} cho ${assetId}: ${reason}`, user, assetId);
      return wo;
    },
    updateWorkOrder: (woId, status, user) => {
      const r = maintenance.updateWorkOrder(woId, status, user, nowMs());
      if (!('error' in r)) logEvent('command', 'info', `Cập nhật WO ${woId} → ${status}`, user, woId);
      return r;
    },
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
      sequences: thermalSequences.length,
      scenarios: thermalScenarios.length,
      ceMatrices: thermalCauseEffect.length,
      byCell: registry.byCell,
      byScanClass: registry.byScanClass,
    }),
    registryTag: (name) => registryByName.get(name),
    catalogScreens: () => catalogScreens,
    sequenceList: () => thermalSequences.map((s) => ({ sequenceId: s.sequenceId, title: s.title, steps: s.steps.length })),
    runSequenceToCompletion: (sequenceId) => runSeqState(sequenceId),
    startLiveSequence: (sequenceId) => {
      const def = thermalSequences.find((s) => s.sequenceId === sequenceId);
      if (!def) return { status: 'failed', stepIndex: -1, stepId: null, message: `không có chuỗi '${sequenceId}'` };
      const eng = new SequenceEngine(def, liveSeqIo);
      eng.start();
      logEvent('sequence', 'info', `Khởi động SFC '${sequenceId}' (live)`, undefined, sequenceId);
      if (eng.state().status === 'running') liveSeqs.set(sequenceId, eng);
      return eng.state();
    },
    liveSequenceState: () => [...liveSeqs.entries()].map(([id, eng]) => ({ sequenceId: id, ...eng.state() })),
    causeEffectMatrices: () => thermalCauseEffect,
    explainAlarm: (alarmId) => {
      const a = boilerAlarms.find((x) => x.alarmId === alarmId);
      return advisor.explainAlarm(alarmId, { value: a ? num(a.tagId) : undefined, nowIso: nowIso() });
    },
    causeEffectState: (matrixId) => ceById.get(matrixId)?.state(),
    resetCauseEffect: (matrixId) => {
      const eng = ceById.get(matrixId);
      if (!eng || !eng.reset()) return false;
      // Xoá luôn flag hiệu ứng đã ghi → sim thấy trip hết → nhà máy phục hồi (OTS: trip → reset → restart).
      const m = thermalCauseEffect.find((x) => x.matrixId === matrixId);
      for (const e of m?.effects ?? []) put(e.tag, 0);
      logEvent('command', 'warn', `RESET Cause&Effect '${matrixId}'`, undefined, matrixId);
      return true;
    },
    scenarioList: () => thermalScenarios.map((s) => ({ scenarioId: s.scenarioId, title: s.title, phases: s.phases.length })),
    runScenario: (scenarioId) => {
      const def = thermalScenarios.find((s) => s.scenarioId === scenarioId);
      if (!def) return [{ phaseId: '(none)', status: 'fail', note: `không có kịch bản '${scenarioId}'`, tags: {} }];
      return executeScenario(def, {
        step,
        setLoad: (mw) => put('BLR_MW_DEMAND', mw),
        inject: (id) => host.inject(model.id, { id }),
        clear: (id) => host.clear(model.id, id),
        set: (tagId, v) => put(tagId, v),
        runSequence: (id) => runSeqState(id).status,
        getTag: (id) => num(id),
      });
    },
    value: (id) => num(id),
    nowIso,
  };
}
