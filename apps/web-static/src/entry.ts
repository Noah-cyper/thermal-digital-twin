// IDTP web-static — LocalBus: chạy createThermalRuntime() NGAY TRONG TRÌNH DUYỆT và giả lập đúng bề mặt
// WebSocket mà client (public/index.html) mong đợi (readyState/send/onopen/onclose/onmessage/close).
// Đây là bản port trung thực của apps/thermal-runtime/src/server.ts sang in-process, đơn-client:
//   • xử lý 31 lệnh WS + phát 29 loại message y hệt server;
//   • RBAC/SecurityEngine (auto-login Operator, 2-step, audit) giống hệt;
//   • vòng step() 100 ms: delta report-by-exception + alarms + seq/ce + permissives + kpi/maint mỗi 50 tick.
// KHÔNG API Node: server.ts là phần Node duy nhất; runtime/plugin/engines đều thuần trình duyệt (đã khảo sát).
// Định nghĩa màn hình (elements) do file JSON tĩnh /screen/<id> phục vụ (client fetch), không đi qua bus.
import type { ScreenDef, PermissionAction, Role, LoopMode, ScreenBuildSpec } from '@idtp/sdk';
import type { ReplaySession } from '@idtp/engines';
import { SecurityEngine, buildScreen } from '@idtp/engines';
import { boilerScreens, screenTags } from '@idtp/plugin-thermal-power-600';
import { createThermalRuntime } from '@idtp/app-thermal-runtime';
import type { OtsSnapshot } from '@idtp/app-thermal-runtime';

const DEMO_USERS: ReadonlyArray<{ user: string; roles: Role[] }> = [
  { user: 'viewer', roles: ['Viewer'] },
  { user: 'operator', roles: ['Operator'] },
  { user: 'supervisor', roles: ['ShiftSupervisor'] },
  { user: 'engineer', roles: ['Engineer'] },
  { user: 'maint', roles: ['Maintenance'] },
  { user: 'admin', roles: ['Admin'] },
];
const CMD_ACTION: Record<string, PermissionAction> = { load: 'setpoint', ack: 'ack', shelve: 'ack', unshelve: 'ack', leak: 'override', 'mill-trip': 'override', vacuum: 'override', mft: 'override', 'turbine-trip': 'override', malf: 'override' };
const LIVE_OTS = new Set(['ots-freeze', 'ots-snapshot', 'ots-restore']);
const LIVE_CMDS = new Set(['load', 'leak', 'mill-trip', 'vacuum', 'ack', 'shelve', 'unshelve', 'set-mode', 'seq-live-start', 'ce-reset', 'mft', 'turbine-trip', 'malf']);
const BANNER_TAGS = ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'BLR_FLUE_O2_01'];
const MODES: ReadonlySet<string> = new Set(['MAN', 'AUTO', 'CASCADE']);

interface Command {
  cmd?: string;
  screenId?: string;
  alarmId?: string;
  value?: number;
  user?: string;
  confirm?: boolean;
  assetId?: string;
  woType?: 'PM' | 'CM';
  reason?: string;
  loopId?: string;
  mode?: string;
  durationMin?: number;
  hours?: number;
  sequenceId?: string;
  matrixId?: string;
  malf?: string;
  spec?: ScreenBuildSpec;
  tags?: ReadonlyArray<string>;
}

type Rt = ReturnType<typeof createThermalRuntime>;

/** Giả lập bề mặt WebSocket đơn-client, phục vụ toàn bộ vòng CCS trong trình duyệt. */
class LocalBus {
  readonly readyState = 1; // luôn OPEN
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  private readonly rt: Rt;
  private readonly sec: SecurityEngine;
  private readonly screensById = new Map<string, ScreenDef>();
  private token: string | undefined;
  private sub: { tags: string[]; last: Map<string, number> } | null = null;
  private replay: ReplaySession | null = null;
  private otsSnap: OtsSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private kpiTick = 0;
  private lastAlarmSig = '';
  private lastSeqSig = '';
  private lastCeSig = '';
  private lastPermSig = '';
  private readonly stepMs: number;

  constructor(stepMs = 100) {
    this.stepMs = stepMs;
    this.rt = createThermalRuntime({ breadthLive: true });
    for (const s of boilerScreens) this.screensById.set(s.screenId, s);
    for (const s of this.rt.catalogScreens()) if (!this.screensById.has(s.screenId)) this.screensById.set(s.screenId, s);
    this.sec = new SecurityEngine({ nowMs: () => Date.now(), formatTs: (ms) => new Date(ms).toISOString() });
    for (const u of DEMO_USERS) this.sec.addUser(u.user, 'p', u.roles);
    const initial = this.sec.authenticate('operator', 'p', 'local'); // auto-login Operator
    if ('access' in initial) this.token = initial.access;
  }

  /** Client gọi sau khi gán onopen/onmessage: bắn onopen + gói message khởi tạo + khởi động vòng step. */
  start(): void {
    setTimeout(() => {
      this.onopen?.();
      // Gói khởi tạo — đúng thứ tự server gửi khi 'connection'.
      this.emit(this.alarmsMsg());
      this.emit(this.modeMsg());
      this.emit(this.authMsg());
      this.emit(this.otsMsg());
      this.emit(this.maintMsg());
      this.emit(this.navMsg());
      this.emit(this.registryMsg());
      this.emit(this.seqListMsg());
      this.emit(this.ceMsg());
      this.emit(this.permMsg());
      this.emit(this.tagsMsg());
      this.timer = setInterval(() => this.tick(), this.stepMs);
    }, 0);
  }

  send(raw: string): void {
    let m: Command;
    try { m = JSON.parse(raw) as Command; } catch { return; }
    this.handle(m);
  }

  close(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.onclose?.();
  }

  // ── phát message tới client ────────────────────────────────────────────────
  private emit(json: string): void { this.onmessage?.({ data: json }); }
  private send1(obj: unknown): void { this.emit(JSON.stringify(obj)); }
  private broadcast(json: string): void { this.emit(json); } // đơn-client: broadcast = gửi cho chính mình

  // ── các message builder (khớp server.ts) ────────────────────────────────────
  private alarmsMsg(): string { return JSON.stringify({ type: 'alarms', active: this.rt.activeAlarms(), shelved: this.rt.shelvedAlarms(), kpi: this.rt.alarmKpi() }); }
  private modeMsg(): string { return JSON.stringify({ type: 'mode', mode: this.replay ? 'REPLAY' : 'LIVE' }); }
  private authMsg(): string {
    const ctx = this.token !== undefined ? this.sec.resolve(this.token) : undefined;
    return JSON.stringify({ type: 'auth', ok: ctx !== undefined, user: ctx?.userId, roles: ctx?.roles });
  }
  private maintMsg(): string { return JSON.stringify({ type: 'maint', runtime: this.rt.maintenanceRuntime(), workOrders: this.rt.workOrders(), mtbf: this.rt.maintenanceMtbf('UNIT1'), predictive: this.rt.predictiveAdvisories() }); }
  private navMsg(): string { return JSON.stringify({ type: 'nav', tree: this.rt.navTree(), alarmIndex: this.rt.navAlarmIndex(), home: this.rt.navHome() }); }
  private registryMsg(): string { return JSON.stringify({ type: 'registry', summary: this.rt.registrySummary() }); }
  private seqListMsg(): string { return JSON.stringify({ type: 'seq-list', items: this.rt.sequenceList() }); }
  private tagsMsg(): string { return JSON.stringify({ type: 'tags', items: this.rt.recordedTags() }); }
  private ceStates(): Array<{ matrixId: string; title: { vi: string; en: string }; state: unknown }> {
    return this.rt.causeEffectMatrices().map((mx) => ({ matrixId: mx.matrixId, title: mx.title, state: this.rt.causeEffectState(mx.matrixId) }));
  }
  private ceMsg(): string { return JSON.stringify({ type: 'ce', matrices: this.ceStates() }); }
  private permMsg(): string { return JSON.stringify({ type: 'permissives', active: this.rt.activeInterlocks() }); }
  private otsMsg(): string { return JSON.stringify({ type: 'ots', frozen: this.rt.isFrozen(), hasSnapshot: this.otsSnap !== null }); }

  // ── stream tag theo màn (report-by-exception) ───────────────────────────────
  private sendScreen(full: boolean): void {
    if (!this.sub) return;
    const values: Record<string, number> = {};
    for (const t of this.sub.tags) {
      const v = Math.round(this.rt.value(t) * 100) / 100;
      const prev = this.sub.last.get(t);
      if (full || prev === undefined || Math.abs(prev - v) >= 0.01) { values[t] = v; this.sub.last.set(t, v); }
    }
    if (Object.keys(values).length > 0) this.send1({ type: 'delta', values });
  }
  private sendReplayFrame(clockMs: number, sess: ReplaySession): void {
    if (!this.sub) return;
    const values: Record<string, number> = {};
    for (const [t, p] of Object.entries(this.rt.historian.frameAt(clockMs, this.sub.tags))) values[t] = Math.round((p as { value: number }).value * 100) / 100;
    this.send1({ type: 'delta', mode: 'REPLAY', replay: sess, values });
  }

  // ── vòng step ───────────────────────────────────────────────────────────────
  private tick(): void {
    this.rt.step();
    if (this.replay) {
      const clockTs = this.rt.historian.advanceReplay(this.replay.id, this.stepMs);
      const sess = this.rt.historian.session(this.replay.id);
      if (clockTs && sess) this.sendReplayFrame(Date.parse(clockTs), sess);
      return;
    }
    this.sendScreen(false);
    this.broadcastAlarms();
    this.broadcastSeqCe();
    this.broadcastPermissives();
    if (++this.kpiTick % 50 === 0) {
      void this.rt.computeKpis().then((results) => this.broadcast(JSON.stringify({ type: 'kpi', results })));
      this.rt.evaluatePredictive();
      this.broadcast(this.maintMsg());
    }
  }
  private broadcastAlarms(): void {
    const sig = this.rt.activeAlarms().map((a) => `${a.alarmId}:${a.state}`).join('|') + '#' + this.rt.shelvedAlarms().map((s) => s.alarmId).join('|');
    if (sig === this.lastAlarmSig) return;
    this.lastAlarmSig = sig;
    this.broadcast(this.alarmsMsg());
  }
  private broadcastSeqCe(): void {
    const seqSig = JSON.stringify(this.rt.liveSequenceState());
    if (seqSig !== this.lastSeqSig) { this.lastSeqSig = seqSig; this.broadcast(JSON.stringify({ type: 'seq-live', active: this.rt.liveSequenceState() })); }
    const ceSig = JSON.stringify(this.ceStates());
    if (ceSig !== this.lastCeSig) { this.lastCeSig = ceSig; this.broadcast(this.ceMsg()); }
  }
  private broadcastPermissives(): void {
    const sig = JSON.stringify(this.rt.activeInterlocks());
    if (sig === this.lastPermSig) return;
    this.lastPermSig = sig;
    this.broadcast(this.permMsg());
  }

  // ── router lệnh (khớp thứ tự if/else trong server.ts) ────────────────────────
  private handle(m: Command): void {
    if (m.cmd === 'login') {
      const who = m.user ?? 'operator';
      const r = this.sec.authenticate(who, 'p', 'local');
      if ('access' in r) { this.token = r.access; this.send1(JSON.parse(this.authMsg())); this.rt.logEvent('security', 'info', `Đăng nhập: ${who}`, who, 'local'); }
      else { this.send1({ type: 'auth', ok: false, error: r.error }); this.rt.logEvent('security', 'warn', `Đăng nhập thất bại: ${who}`, who, 'local'); }
      return;
    }
    if (m.cmd === 'audit-query') { this.send1({ type: 'audit', entries: this.sec.auditList().slice(-20) }); return; }
    if (this.replay && m.cmd !== undefined && LIVE_CMDS.has(m.cmd)) { this.send1({ type: 'blocked', reason: 'DATA REPLAY: lệnh ra thiết bị bị chặn (an toàn)' }); return; }

    if (m.cmd === 'screen' && m.screenId !== undefined && this.screensById.has(m.screenId)) {
      const scr = this.screensById.get(m.screenId);
      if (scr) { this.sub = { tags: [...new Set([...screenTags(scr), ...BANNER_TAGS])], last: new Map() }; if (!this.replay) this.sendScreen(true); }
    } else if (m.cmd !== undefined && m.cmd in CMD_ACTION) { this.handleWrite(m); }
    else if (m.cmd !== undefined && LIVE_OTS.has(m.cmd)) { this.handleOts(m.cmd, m.value); }
    else if (m.cmd === 'maintenance-query') { this.send1(JSON.parse(this.maintMsg())); }
    else if (m.cmd === 'create-wo') { this.handleCreateWo(m); }
    else if (m.cmd === 'nav-query') { this.send1(JSON.parse(this.navMsg())); }
    else if (m.cmd === 'permissive-query') { this.send1(JSON.parse(this.permMsg())); }
    else if (m.cmd === 'faceplate-list') { this.send1({ type: 'fp-list', items: this.rt.faceplateList() }); }
    else if (m.cmd === 'faceplate-open' && m.assetId !== undefined) { this.send1({ type: 'fp-data', assetId: m.assetId, data: this.rt.faceplateData(m.assetId) ?? null }); }
    else if (m.cmd === 'faceplate-trend' && m.assetId !== undefined) { const a = m.assetId; void this.rt.faceplateTrend(a, m.hours ?? 1).then((trend) => this.send1({ type: 'fp-trend', assetId: a, trend })); }
    else if (m.cmd === 'set-mode') { this.handleSetMode(m); }
    else if (m.cmd === 'seq-live-start') { this.handleSeqLive(m); }
    else if (m.cmd === 'ce-reset') { this.handleCeReset(m); }
    else if (m.cmd === 'advise' && m.alarmId !== undefined) {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else this.send1({ type: 'advice', advice: this.rt.explainAlarm(m.alarmId) ?? null });
    } else if (m.cmd === 'resim') {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else {
        const opts = m.malf ? { malfunction: m.malf } : typeof m.value === 'number' ? { overrides: { BLR_MW_DEMAND: m.value } } : {};
        const result = this.rt.reSimulate({ ...opts, steps: 500, sampleTags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01'], everyN: 25 });
        this.send1({ type: 'resim', label: m.malf ?? (m.value !== undefined ? `tải ${m.value} MW` : 'cơ sở'), result });
      }
    } else if (m.cmd === 'build-screen') { this.handleBuildScreen(m); }
    else if (m.cmd === 'trend') {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else void this.rt.trendSeries(Array.isArray(m.tags) ? m.tags : [], m.hours ?? 1).then((r) => this.send1({ type: 'trend-series', ...r }));
    } else if (m.cmd === 'report') {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else void this.rt.generateReport(m.hours ?? 8).then((report) => this.send1({ type: 'report', report }));
    } else if (m.cmd === 'journal') {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else this.send1({ type: 'journal', entries: this.rt.eventLog({ limit: 150 }), summary: this.rt.eventSummary() });
    } else if (m.cmd === 'diag') {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else this.send1({ type: 'diag', diag: this.rt.systemDiagnostics() });
    } else if (m.cmd === 'alarm-rationalization') {
      if (this.token === undefined) this.send1({ type: 'denied', reason: 'chưa đăng nhập' });
      else this.send1({ type: 'alarm-rationalization', report: this.rt.alarmRationalization() });
    } else if (m.cmd === 'replay-start') {
      const range = this.rt.historian.dataRange();
      if (range) { this.replay = this.rt.historian.openReplay(range.from, range.to, 1); this.broadcast(this.modeMsg()); }
    } else if (m.cmd === 'replay-speed' && typeof m.value === 'number' && this.replay) { this.rt.historian.setSpeed(this.replay.id, m.value); }
    else if (m.cmd === 'replay-seek' && typeof m.value === 'number' && this.replay) {
      const range = this.rt.historian.dataRange();
      if (range) { const f = Date.parse(range.from); const t = Date.parse(range.to); this.rt.historian.seek(this.replay.id, new Date(f + Math.max(0, Math.min(1, m.value)) * (t - f)).toISOString()); }
    } else if (m.cmd === 'replay-stop' && this.replay) { this.rt.historian.closeReplay(this.replay.id); this.replay = null; this.broadcast(this.modeMsg()); }
  }

  // ── handlers (khớp server.ts) ────────────────────────────────────────────────
  private handleWrite(m: Command): void {
    const cmd = m.cmd as string;
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    if (cmd === 'load') {
      const il = this.rt.interlockCheck('load');
      if (il.blocked) { this.send1({ type: 'blocked', target: 'load', reasons: il.reasons }); this.rt.logEvent('command', 'warn', `Lệnh tải bị interlock chặn: ${il.reasons.join('; ')}`, undefined, 'load'); return; }
    }
    const action = CMD_ACTION[cmd] as PermissionAction;
    const target =
      cmd === 'ack' || cmd === 'shelve' || cmd === 'unshelve' ? m.alarmId ?? '' : cmd === 'load' ? 'BLR_MW_DEMAND' : cmd === 'leak' ? 'tube-leak' : cmd === 'vacuum' ? 'loss-of-vacuum' : cmd === 'mft' ? 'BLR_MFT_PB' : cmd === 'turbine-trip' ? 'TRB_TRIP_PB' : cmd === 'malf' ? m.malf ?? 'malf' : 'mill';
    const oldVal = cmd === 'load' ? this.rt.value('BLR_MW_DEMAND') : undefined;
    const newVal = cmd === 'load' ? m.value : cmd === 'leak' || cmd === 'vacuum' || cmd === 'malf' ? m.value : cmd === 'ack' || cmd === 'shelve' || cmd === 'unshelve' ? m.alarmId : 'trip';

    let confirmToken: string | undefined;
    if (this.sec.requiresTwoStep(action)) {
      if (m.confirm !== true) { this.send1({ type: 'confirm-needed', cmd, value: m.value, alarmId: m.alarmId, malf: m.malf, action, target }); return; }
      const ctx = this.sec.resolve(this.token);
      if (ctx) confirmToken = this.sec.requestConfirm(ctx, action, target);
    }
    const res = this.sec.guardedWrite(this.token, action, target, oldVal, newVal, `WS ${cmd}`, confirmToken);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }

    if (cmd === 'load' && typeof m.value === 'number') this.rt.setLoadDemand(m.value);
    else if (cmd === 'mill-trip') this.rt.injectMalfunction({ id: 'mill-trip' });
    else if (cmd === 'mft') this.rt.manualTrip('mft');
    else if (cmd === 'turbine-trip') this.rt.manualTrip('turbine');
    else if (cmd === 'malf' && typeof m.malf === 'string') {
      if (typeof m.value === 'number' && m.value <= 0) this.rt.clearMalfunction(m.malf);
      else this.rt.injectMalfunction({ id: m.malf });
    } else if (cmd === 'leak') {
      if (typeof m.value === 'number' && m.value > 0) this.rt.injectMalfunction({ id: 'tube-leak', params: { rate: m.value } });
      else this.rt.clearMalfunction('tube-leak');
    } else if (cmd === 'vacuum') {
      if (typeof m.value === 'number' && m.value > 6) this.rt.injectMalfunction({ id: 'loss-of-vacuum', params: { kpa: m.value } });
      else this.rt.clearMalfunction('loss-of-vacuum');
    } else if (cmd === 'ack' && m.alarmId !== undefined) this.rt.ackAlarm(m.alarmId, this.sec.resolve(this.token)?.userId ?? 'operator');
    else if (cmd === 'shelve' && m.alarmId !== undefined) {
      const r = this.rt.shelveAlarm(m.alarmId, m.durationMin ?? 60, m.reason ?? '', this.sec.resolve(this.token)?.userId ?? 'operator');
      if ('blockedReason' in r) { this.send1({ type: 'denied', reason: r.blockedReason }); return; }
      this.broadcast(this.alarmsMsg());
    } else if (cmd === 'unshelve' && m.alarmId !== undefined) {
      const r = this.rt.unshelveAlarm(m.alarmId, this.sec.resolve(this.token)?.userId ?? 'operator');
      if ('blockedReason' in r) { this.send1({ type: 'denied', reason: r.blockedReason }); return; }
      this.broadcast(this.alarmsMsg());
    }
  }

  private handleOts(cmd: string, value?: number): void {
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    const res = this.sec.guardedWrite(this.token, 'engineer', cmd, undefined, value, `OTS ${cmd}`);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }
    if (cmd === 'ots-freeze') this.rt.freeze(value !== 0);
    else if (cmd === 'ots-snapshot') this.otsSnap = this.rt.snapshot();
    else if (cmd === 'ots-restore' && this.otsSnap) this.rt.restore(this.otsSnap);
    this.broadcast(this.otsMsg());
  }

  private handleSeqLive(m: Command): void {
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    const id = m.sequenceId ?? '';
    const il = this.rt.interlockCheck(id);
    if (il.blocked) { this.send1({ type: 'blocked', target: id, reasons: il.reasons }); this.rt.logEvent('command', 'warn', `SFC '${id}' bị interlock chặn: ${il.reasons.join('; ')}`, undefined, id); return; }
    const res = this.sec.guardedWrite(this.token, 'engineer', id, undefined, 'start', `SFC live ${id}`);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }
    this.rt.startLiveSequence(id);
    this.broadcast(JSON.stringify({ type: 'seq-live', active: this.rt.liveSequenceState() }));
  }

  private handleCeReset(m: Command): void {
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    const id = m.matrixId ?? '';
    const res = this.sec.guardedWrite(this.token, 'engineer', id, undefined, 'reset', `C&E reset ${id}`);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }
    this.rt.resetCauseEffect(id);
    this.broadcast(this.ceMsg());
  }

  private handleBuildScreen(m: Command): void {
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    const res = this.sec.guardedWrite(this.token, 'engineer', m.spec?.screenId ?? '', undefined, 'build-screen', `build screen ${m.spec?.screenId ?? ''}`);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }
    if (!m.spec) { this.send1({ type: 'denied', reason: 'thiếu spec' }); return; }
    let def: ScreenDef;
    try { def = buildScreen(m.spec); } catch (e) { this.send1({ type: 'denied', reason: 'spec lỗi: ' + (e as Error).message }); return; }
    this.screensById.set(def.screenId, def);
    this.send1({ type: 'built-screen', def });
  }

  private handleCreateWo(m: Command): void {
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    const assetId = m.assetId ?? 'UNIT1';
    const res = this.sec.guardedWrite(this.token, 'oos', assetId, undefined, m.woType ?? 'CM', `create work order ${assetId}`);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }
    this.rt.createWorkOrder(assetId, m.woType ?? 'CM', m.reason ?? 'sự cố', this.sec.resolve(this.token)?.userId ?? 'maint');
    this.broadcast(this.maintMsg());
  }

  private handleSetMode(m: Command): void {
    if (this.token === undefined) { this.send1({ type: 'denied', reason: 'chưa đăng nhập' }); return; }
    const loopId = m.loopId ?? '';
    const mode = m.mode ?? '';
    if (!MODES.has(mode)) { this.send1({ type: 'denied', reason: 'mode không hợp lệ' }); return; }
    if (mode !== 'MAN') {
      const il = this.rt.interlockCheck(loopId);
      if (il.blocked) { this.send1({ type: 'blocked', target: loopId, reasons: il.reasons }); this.rt.logEvent('command', 'warn', `Chuyển ${mode} loop '${loopId}' bị interlock chặn: ${il.reasons.join('; ')}`, undefined, loopId); return; }
    }
    if (m.confirm !== true) { this.send1({ type: 'confirm-needed', cmd: 'set-mode', loopId, mode, action: 'mode', target: loopId }); return; }
    const ctx = this.sec.resolve(this.token);
    const confirmToken = ctx ? this.sec.requestConfirm(ctx, 'mode', loopId) : undefined;
    const res = this.sec.guardedWrite(this.token, 'mode', loopId, undefined, mode, `set mode ${loopId}`, confirmToken);
    if (!res.allow) { this.send1({ type: 'denied', reason: res.reason }); return; }
    this.rt.setLoopMode(loopId, mode as LoopMode);
  }
}

// Xuất ra global đúng hợp đồng mà index.html dòng 784 kỳ vọng: window.IDTPLocal.connect() → đối tượng WS-like.
declare global {
  interface Window { IDTPLocal?: { connect: () => LocalBus }; }
}
window.IDTPLocal = {
  connect(): LocalBus {
    const bus = new LocalBus(100);
    bus.start();
    return bus;
  },
};
