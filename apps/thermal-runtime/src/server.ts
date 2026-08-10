// apps/thermal-runtime server — chạy vòng CCS khép kín, phục vụ màn hình KHAI BÁO của plugin
// (D1 + D3) và stream tag theo TỪNG màn hình (subscribe-by-screen, report-by-exception) qua WS.
// Màn hình là JSON khai báo; client render generic theo symbol. Không hardcode màn hình process.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { ScreenDef, PermissionAction, Role, LoopMode, ScreenBuildSpec } from '@idtp/sdk';
import type { ReplaySession } from '@idtp/engines';
import { SecurityEngine, buildScreen } from '@idtp/engines';
import { boilerScreens, screenTags } from '@idtp/plugin-thermal-power-600';
import { startPersistence } from './persistence';
import { startFieldLink, type FieldLink } from './field-link';
import { makeModbusTcpDriver } from './field-drivers';
import type { FieldPoint, FieldProtocol } from '@idtp/sdk';
import { createThermalRuntime } from './runtime';
import type { OtsSnapshot } from './runtime';

// Người dùng demo (mật khẩu 'p') — đủ minh hoạ RBAC 6 vai. Thật: SSO/LDAP (doc 18).
const DEMO_USERS: ReadonlyArray<{ user: string; roles: Role[] }> = [
  { user: 'viewer', roles: ['Viewer'] },
  { user: 'operator', roles: ['Operator'] },
  { user: 'supervisor', roles: ['ShiftSupervisor'] },
  { user: 'engineer', roles: ['Engineer'] },
  { user: 'maint', roles: ['Maintenance'] },
  { user: 'admin', roles: ['Admin'] },
];
// Ánh xạ lệnh WS → hành động RBAC (doc 05-07). load = setpoint; leak/mill-trip = override (OTS nguy hiểm).
const CMD_ACTION: Record<string, PermissionAction> = { load: 'setpoint', ack: 'ack', shelve: 'ack', unshelve: 'ack', leak: 'override', 'mill-trip': 'override', vacuum: 'override', mft: 'override', 'turbine-trip': 'override', malf: 'override' };
const LIVE_OTS = new Set(['ots-freeze', 'ots-snapshot', 'ots-restore']); // OTS: action 'engineer'
// 4 KPI trên banner (MW · hơi · áp · O₂) là trạng thái TOÀN CỤC — luôn stream dù đang xem màn nào.
const BANNER_TAGS = ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'BLR_FLUE_O2_01'];

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');

const screensById = new Map<string, ScreenDef>(boilerScreens.map((s) => [s.screenId, s]));
const registry = boilerScreens.map((s) => ({ screenId: s.screenId, level: s.level, title: s.title }));

interface Sub {
  tags: string[];
  last: Map<string, number>;
}
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

const LIVE_CMDS = new Set(['load', 'leak', 'mill-trip', 'vacuum', 'ack', 'shelve', 'unshelve', 'set-mode', 'seq-live-start', 'ce-reset', 'mft', 'turbine-trip', 'malf']); // lệnh ra thiết bị — chặn khi replay
const MODES: ReadonlySet<string> = new Set(['MAN', 'AUTO', 'CASCADE']);

export interface RunningServer {
  server: http.Server;
  wss: WebSocketServer;
  ready: Promise<number>;
  close(): Promise<void>;
}

export function startServer(port = 8080, opts: { stepMs?: number } = {}): RunningServer {
  const stepMs = opts.stepMs ?? 100;
  const rt = createThermalRuntime({ breadthLive: true }); // demo: cả §10 catalog "sống"
  // Đăng ký màn hình catalog §10 (87 màn) để phục vụ qua /screen — mở bằng id thấy dữ liệu breadth live.
  for (const s of rt.catalogScreens()) {
    if (!screensById.has(s.screenId)) {
      screensById.set(s.screenId, s);
      registry.push({ screenId: s.screenId, level: s.level, title: s.title });
    }
  }
  const subs = new Map<WebSocket, Sub>();

  // Security/RBAC — enforcement ở tầng API gateway (server). Clock thực (auth không phải sim data).
  const sec = new SecurityEngine({ nowMs: () => Date.now(), formatTs: (ms) => new Date(ms).toISOString() });
  for (const u of DEMO_USERS) sec.addUser(u.user, 'p', u.roles);
  const tokens = new Map<WebSocket, string>(); // ws → access token

  const server = http.createServer((req, res) => {
    try {
      const url = req.url ?? '/';
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(join(PUBLIC, 'index.html')));
      } else if (url === '/fleet' || url === '/fleet.html') {
        // FLEET view (v1.66): 1 trang gom CẢ 2 digital twin — nhiệt điện (self) + nước (:8090) — mỗi twin 1 thẻ.
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(join(PUBLIC, 'fleet.html')));
      } else if (url === '/screens') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(registry));
      } else if (url.startsWith('/screen/')) {
        const scr = screensById.get(url.slice('/screen/'.length));
        if (!scr) {
          res.writeHead(404);
          res.end('unknown screen');
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(scr));
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    } catch {
      res.writeHead(500);
      res.end('server error');
    }
  });

  const sendScreen = (ws: WebSocket, full: boolean): void => {
    const sub = subs.get(ws);
    if (!sub) return;
    const values: Record<string, number> = {};
    for (const t of sub.tags) {
      const v = Math.round(rt.value(t) * 100) / 100;
      const prev = sub.last.get(t);
      if (full || prev === undefined || Math.abs(prev - v) >= 0.01) {
        values[t] = v;
        sub.last.set(t, v);
      }
    }
    if (Object.keys(values).length > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'delta', values }));
    }
  };

  const alarmsMsg = (): string => JSON.stringify({ type: 'alarms', active: rt.activeAlarms(), shelved: rt.shelvedAlarms(), kpi: rt.alarmKpi() });

  let replay: ReplaySession | null = null;
  const wss = new WebSocketServer({ server });
  const broadcast = (msg: string): void => {
    for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  };
  const modeMsg = (): string => JSON.stringify({ type: 'mode', mode: replay ? 'REPLAY' : 'LIVE' });
  const authMsg = (ws: WebSocket): string => {
    const a = tokens.get(ws);
    const ctx = a !== undefined ? sec.resolve(a) : undefined;
    return JSON.stringify({ type: 'auth', ok: ctx !== undefined, user: ctx?.userId, roles: ctx?.roles });
  };

  // Lệnh ghi thiết bị → RBAC guardedWrite + audit bất biến + xác nhận 2 bước (doc 05-07).
  const handleWrite = (ws: WebSocket, m: Command): void => {
    const cmd = m.cmd as string;
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    // Interlock/permissive (W6 DoD): chặn TRƯỚC RBAC/2-step nếu điều kiện quá trình không cho phép — HIỆN LÝ DO.
    if (cmd === 'load') {
      const il = rt.interlockCheck('load');
      if (il.blocked) {
        ws.send(JSON.stringify({ type: 'blocked', target: 'load', reasons: il.reasons }));
        rt.logEvent('command', 'warn', `Lệnh tải bị interlock chặn: ${il.reasons.join('; ')}`, undefined, 'load');
        return;
      }
    }
    const action = CMD_ACTION[cmd] as PermissionAction;
    const target =
      cmd === 'ack' || cmd === 'shelve' || cmd === 'unshelve' ? m.alarmId ?? '' : cmd === 'load' ? 'BLR_MW_DEMAND' : cmd === 'leak' ? 'tube-leak' : cmd === 'vacuum' ? 'loss-of-vacuum' : cmd === 'mft' ? 'BLR_MFT_PB' : cmd === 'turbine-trip' ? 'TRB_TRIP_PB' : cmd === 'malf' ? m.malf ?? 'malf' : 'mill';
    const oldVal = cmd === 'load' ? rt.value('BLR_MW_DEMAND') : undefined;
    const newVal = cmd === 'load' ? m.value : cmd === 'leak' || cmd === 'vacuum' || cmd === 'malf' ? m.value : cmd === 'ack' || cmd === 'shelve' || cmd === 'unshelve' ? m.alarmId : 'trip';

    let confirmToken: string | undefined;
    if (sec.requiresTwoStep(action)) {
      if (m.confirm !== true) {
        ws.send(JSON.stringify({ type: 'confirm-needed', cmd, value: m.value, alarmId: m.alarmId, malf: m.malf, action, target }));
        return;
      }
      const ctx = sec.resolve(access);
      if (ctx) confirmToken = sec.requestConfirm(ctx, action, target);
    }

    const res = sec.guardedWrite(access, action, target, oldVal, newVal, `WS ${cmd}`, confirmToken);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    if (cmd === 'load' && typeof m.value === 'number') rt.setLoadDemand(m.value);
    else if (cmd === 'mill-trip') rt.injectMalfunction({ id: 'mill-trip' });
    else if (cmd === 'mft') rt.manualTrip('mft'); // nút MFT tay → cause C&E → sim cắt nhiên liệu
    else if (cmd === 'turbine-trip') rt.manualTrip('turbine'); // nút trip turbine tay → C&E → MW = 0
    else if (cmd === 'malf' && typeof m.malf === 'string') {
      if (typeof m.value === 'number' && m.value <= 0) rt.clearMalfunction(m.malf);
      else rt.injectMalfunction({ id: m.malf });
    } else if (cmd === 'leak') {
      if (typeof m.value === 'number' && m.value > 0) rt.injectMalfunction({ id: 'tube-leak', params: { rate: m.value } });
      else rt.clearMalfunction('tube-leak');
    } else if (cmd === 'vacuum') {
      if (typeof m.value === 'number' && m.value > 6) rt.injectMalfunction({ id: 'loss-of-vacuum', params: { kpa: m.value } });
      else rt.clearMalfunction('loss-of-vacuum');
    } else if (cmd === 'ack' && m.alarmId !== undefined) rt.ackAlarm(m.alarmId, sec.resolve(access)?.userId ?? 'operator');
    else if (cmd === 'shelve' && m.alarmId !== undefined) {
      const r = rt.shelveAlarm(m.alarmId, m.durationMin ?? 60, m.reason ?? '', sec.resolve(access)?.userId ?? 'operator');
      if ('blockedReason' in r) {
        ws.send(JSON.stringify({ type: 'denied', reason: r.blockedReason }));
        return;
      }
      broadcast(alarmsMsg());
    } else if (cmd === 'unshelve' && m.alarmId !== undefined) {
      const r = rt.unshelveAlarm(m.alarmId, sec.resolve(access)?.userId ?? 'operator');
      if ('blockedReason' in r) {
        ws.send(JSON.stringify({ type: 'denied', reason: r.blockedReason }));
        return;
      }
      broadcast(alarmsMsg());
    }
  };

  const maintMsg = (): string =>
    JSON.stringify({ type: 'maint', runtime: rt.maintenanceRuntime(), workOrders: rt.workOrders(), mtbf: rt.maintenanceMtbf('UNIT1'), predictive: rt.predictiveAdvisories() });
  const navMsg = (): string => JSON.stringify({ type: 'nav', tree: rt.navTree(), alarmIndex: rt.navAlarmIndex(), home: rt.navHome() });
  const registryMsg = (): string => JSON.stringify({ type: 'registry', summary: rt.registrySummary() });
  const seqListMsg = (): string => JSON.stringify({ type: 'seq-list', items: rt.sequenceList() });
  const tagsMsg = (): string => JSON.stringify({ type: 'tags', items: rt.recordedTags() }); // nguồn tag cho Screen Builder
  const ceStates = (): Array<{ matrixId: string; title: { vi: string; en: string }; state: unknown }> =>
    rt.causeEffectMatrices().map((mx) => ({ matrixId: mx.matrixId, title: mx.title, state: rt.causeEffectState(mx.matrixId) }));
  const ceMsg = (): string => JSON.stringify({ type: 'ce', matrices: ceStates() });
  const permMsg = (): string => JSON.stringify({ type: 'permissives', active: rt.activeInterlocks() }); // interlock đang chặn
  let fieldLink: FieldLink | undefined; // (6) field I/O southbound — gán khi bật env; mặc định undefined (chưa bật)
  const fieldStatusMsg = (): string =>
    JSON.stringify({ type: 'field-status', enabled: fieldLink !== undefined, status: fieldLink?.status() ?? null, samples: fieldLink?.samples().length ?? 0 });

  // Chạy SFC "live" (điều khiển OTS, cùng lớp với freeze) — action 'engineer' (Engineer+), audit, không 2 bước.
  const handleSeqLive = (ws: WebSocket, m: Command): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const id = m.sequenceId ?? '';
    const il = rt.interlockCheck(id); // permissive khởi động chuỗi (vd mill-a-start cần đủ gió cháy)
    if (il.blocked) {
      ws.send(JSON.stringify({ type: 'blocked', target: id, reasons: il.reasons }));
      rt.logEvent('command', 'warn', `SFC '${id}' bị interlock chặn: ${il.reasons.join('; ')}`, undefined, id);
      return;
    }
    const res = sec.guardedWrite(access, 'engineer', id, undefined, 'start', `SFC live ${id}`);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    rt.startLiveSequence(id);
    broadcast(JSON.stringify({ type: 'seq-live', active: rt.liveSequenceState() }));
  };

  // Reset trip Cause&Effect — action 'engineer', audit. Chỉ thành công khi hết nguyên nhân active.
  const handleCeReset = (ws: WebSocket, m: Command): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const id = m.matrixId ?? '';
    const res = sec.guardedWrite(access, 'engineer', id, undefined, 'reset', `C&E reset ${id}`);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    rt.resetCauseEffect(id);
    broadcast(ceMsg());
  };

  // Screen Builder (L5 Engineering) — dựng ScreenDef từ spec + đăng ký để render ngay. Action 'engineer', audit.
  const handleBuildScreen = (ws: WebSocket, m: Command): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const res = sec.guardedWrite(access, 'engineer', m.spec?.screenId ?? '', undefined, 'build-screen', `build screen ${m.spec?.screenId ?? ''}`);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    if (!m.spec) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'thiếu spec' }));
      return;
    }
    let def: ScreenDef;
    try {
      def = buildScreen(m.spec);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'spec lỗi: ' + (e as Error).message }));
      return;
    }
    screensById.set(def.screenId, def);
    if (!registry.some((r) => r.screenId === def.screenId)) registry.push({ screenId: def.screenId, level: def.level, title: def.title });
    ws.send(JSON.stringify({ type: 'built-screen', def }));
  };

  // Tạo work order — action 'oos' (Maintenance/ShiftSup/Engineer/Admin), audit, không 2 bước.
  const handleCreateWo = (ws: WebSocket, m: Command): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const assetId = m.assetId ?? 'UNIT1';
    const res = sec.guardedWrite(access, 'oos', assetId, undefined, m.woType ?? 'CM', `create work order ${assetId}`);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    rt.createWorkOrder(assetId, m.woType ?? 'CM', m.reason ?? 'sự cố', sec.resolve(access)?.userId ?? 'maint');
    broadcast(maintMsg());
  };

  // Đổi mode loop (MAN/AUTO/CASCADE) từ faceplate — action 'mode' (xác nhận 2 bước) + audit.
  const handleSetMode = (ws: WebSocket, m: Command): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const loopId = m.loopId ?? '';
    const mode = m.mode ?? '';
    if (!MODES.has(mode)) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'mode không hợp lệ' }));
      return;
    }
    // Permissive: chuyển AUTO/CASCADE cần điều kiện quá trình cho phép (vd loop mức khi bao hơi không HH/LL).
    if (mode !== 'MAN') {
      const il = rt.interlockCheck(loopId);
      if (il.blocked) {
        ws.send(JSON.stringify({ type: 'blocked', target: loopId, reasons: il.reasons }));
        rt.logEvent('command', 'warn', `Chuyển ${mode} loop '${loopId}' bị interlock chặn: ${il.reasons.join('; ')}`, undefined, loopId);
        return;
      }
    }
    if (m.confirm !== true) {
      ws.send(JSON.stringify({ type: 'confirm-needed', cmd: 'set-mode', loopId, mode, action: 'mode', target: loopId }));
      return;
    }
    const ctx = sec.resolve(access);
    const confirmToken = ctx ? sec.requestConfirm(ctx, 'mode', loopId) : undefined;
    const res = sec.guardedWrite(access, 'mode', loopId, undefined, mode, `set mode ${loopId}`, confirmToken);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    rt.setLoopMode(loopId, mode as LoopMode);
  };

  // OTS session control (freeze/snapshot/restore) — action 'engineer', audit, không 2 bước (thao tác đảo được).
  let otsSnap: OtsSnapshot | null = null;
  const otsMsg = (): string => JSON.stringify({ type: 'ots', frozen: rt.isFrozen(), hasSnapshot: otsSnap !== null });
  const handleOts = (ws: WebSocket, cmd: string, value?: number): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const res = sec.guardedWrite(access, 'engineer', cmd, undefined, value, `OTS ${cmd}`);
    if (!res.allow) {
      ws.send(JSON.stringify({ type: 'denied', reason: res.reason }));
      return;
    }
    if (cmd === 'ots-freeze') rt.freeze(value !== 0);
    else if (cmd === 'ots-snapshot') otsSnap = rt.snapshot();
    else if (cmd === 'ots-restore' && otsSnap) rt.restore(otsSnap);
    broadcast(otsMsg());
  };

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress ?? '?';
    const initial = sec.authenticate('operator', 'p', clientIp); // auto-login vai Operator để dùng ngay
    if ('access' in initial) tokens.set(ws, initial.access);
    ws.send(alarmsMsg());
    ws.send(modeMsg());
    ws.send(authMsg(ws));
    ws.send(otsMsg());
    ws.send(maintMsg());
    ws.send(navMsg());
    ws.send(registryMsg());
    ws.send(seqListMsg());
    ws.send(ceMsg());
    ws.send(permMsg());
    ws.send(tagsMsg());

    ws.on('message', (data) => {
      let m: Command;
      try {
        m = JSON.parse(data.toString()) as Command;
      } catch {
        return;
      }
      if (m.cmd === 'login') {
        const who = m.user ?? 'operator';
        const r = sec.authenticate(who, 'p', clientIp);
        if ('access' in r) {
          tokens.set(ws, r.access);
          ws.send(authMsg(ws));
          rt.logEvent('security', 'info', `Đăng nhập: ${who}`, who, clientIp);
        } else {
          ws.send(JSON.stringify({ type: 'auth', ok: false, error: r.error }));
          rt.logEvent('security', 'warn', `Đăng nhập thất bại: ${who}`, who, clientIp);
        }
        return;
      }
      if (m.cmd === 'audit-query') {
        ws.send(JSON.stringify({ type: 'audit', entries: sec.auditList().slice(-20) }));
        return;
      }
      // DATA REPLAY: chặn CỨNG mọi lệnh ra thiết bị ở tầng server (doc 05-04 §4/§10, §12.2 prompt cha).
      if (replay && m.cmd !== undefined && LIVE_CMDS.has(m.cmd)) {
        ws.send(JSON.stringify({ type: 'blocked', reason: 'DATA REPLAY: lệnh ra thiết bị bị chặn (an toàn)' }));
        return;
      }
      if (m.cmd === 'screen' && m.screenId !== undefined && screensById.has(m.screenId)) {
        const scr = screensById.get(m.screenId);
        if (scr) {
          subs.set(ws, { tags: [...new Set([...screenTags(scr), ...BANNER_TAGS])], last: new Map() });
          if (!replay) sendScreen(ws, true);
        }
      } else if (m.cmd !== undefined && m.cmd in CMD_ACTION) {
        handleWrite(ws, m);
      } else if (m.cmd !== undefined && LIVE_OTS.has(m.cmd)) {
        handleOts(ws, m.cmd, m.value);
      } else if (m.cmd === 'maintenance-query') {
        ws.send(maintMsg());
      } else if (m.cmd === 'create-wo') {
        handleCreateWo(ws, m);
      } else if (m.cmd === 'nav-query') {
        ws.send(navMsg());
      } else if (m.cmd === 'permissive-query') {
        ws.send(permMsg());
      } else if (m.cmd === 'field-status') {
        ws.send(fieldStatusMsg()); // Field I/O southbound READ-ONLY (trạng thái kết nối, mặc định ngắt)
      } else if (m.cmd === 'faceplate-list') {
        ws.send(JSON.stringify({ type: 'fp-list', items: rt.faceplateList() }));
      } else if (m.cmd === 'faceplate-open' && m.assetId !== undefined) {
        ws.send(JSON.stringify({ type: 'fp-data', assetId: m.assetId, data: rt.faceplateData(m.assetId) ?? null }));
      } else if (m.cmd === 'faceplate-trend' && m.assetId !== undefined) {
        const asset = m.assetId;
        void rt.faceplateTrend(asset, m.hours ?? 1).then((trend) => ws.send(JSON.stringify({ type: 'fp-trend', assetId: asset, trend })));
      } else if (m.cmd === 'set-mode') {
        handleSetMode(ws, m);
      } else if (m.cmd === 'seq-live-start') {
        handleSeqLive(ws, m);
      } else if (m.cmd === 'ce-reset') {
        handleCeReset(ws, m);
      } else if (m.cmd === 'advise' && m.alarmId !== undefined) {
        // AI Advisor READ-ONLY: chỉ cần đăng nhập, không đổi thiết bị → không chặn khi replay.
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'advice', advice: rt.explainAlarm(m.alarmId) ?? null }));
      } else if (m.cmd === 'resim') {
        // RE-SIMULATION what-if READ-ONLY: nhánh độc lập từ snapshot, sim live KHÔNG bị đụng.
        if (tokens.get(ws) === undefined) {
          ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        } else {
          const opts = m.malf ? { malfunction: m.malf } : typeof m.value === 'number' ? { overrides: { BLR_MW_DEMAND: m.value } } : {};
          const result = rt.reSimulate({ ...opts, steps: 500, sampleTags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01'], everyN: 25 });
          ws.send(JSON.stringify({ type: 'resim', label: m.malf ?? (m.value !== undefined ? `tải ${m.value} MW` : 'cơ sở'), result }));
        }
      } else if (m.cmd === 'build-screen') {
        handleBuildScreen(ws, m);
      } else if (m.cmd === 'trend') {
        // Màn Trend đa-tag READ-ONLY: chỉ cần đăng nhập; chuỗi mẫu lấy từ Historian thật.
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else void rt.trendSeries(Array.isArray(m.tags) ? m.tags : [], m.hours ?? 1).then((r) => ws.send(JSON.stringify({ type: 'trend-series', ...r })));
      } else if (m.cmd === 'report') {
        // Báo cáo ca/ngày READ-ONLY: chỉ cần đăng nhập.
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else void rt.generateReport(m.hours ?? 8).then((report) => ws.send(JSON.stringify({ type: 'report', report })));
      } else if (m.cmd === 'journal') {
        // Event Log / SOE READ-ONLY: chỉ cần đăng nhập; trả nhật ký + tổng hợp (không đụng thiết bị).
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'journal', entries: rt.eventLog({ limit: 150 }), summary: rt.eventSummary() }));
      } else if (m.cmd === 'diag') {
        // System Diagnostic READ-ONLY: tự soi trạng thái runtime (sim/tag/loop/historian/alarm/journal).
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'diag', diag: rt.systemDiagnostics() }));
      } else if (m.cmd === 'alarm-rationalization') {
        // Master alarm rationalization READ-ONLY (ISA-18.2): bảng nguyên nhân/hậu quả/ưu tiên + phân bố EEMUA.
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'alarm-rationalization', report: rt.alarmRationalization() }));
      } else if (m.cmd === 'ai-fleet') {
        // AI Cognitive Maintenance READ-ONLY (P5): tổng quan sức khoẻ fleet + chế độ provider (gắn nhãn trung thực).
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'ai-fleet', overview: rt.cognitiveFleet(), info: rt.cognitiveInfo() }));
      } else if (m.cmd === 'ai-assess' && m.assetId !== undefined) {
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'ai-assess', assetId: m.assetId, assessment: rt.cognitiveAssess(m.assetId) ?? null }));
      } else if (m.cmd === 'ai-diagnose' && m.assetId !== undefined) {
        if (tokens.get(ws) === undefined) ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
        else ws.send(JSON.stringify({ type: 'ai-diagnose', assetId: m.assetId, diagnosis: rt.cognitiveDiagnose(m.assetId) ?? null }));
      } else if (m.cmd === 'replay-start') {
        const range = rt.historian.dataRange();
        if (range) {
          replay = rt.historian.openReplay(range.from, range.to, 1);
          broadcast(modeMsg());
        }
      } else if (m.cmd === 'replay-speed' && typeof m.value === 'number' && replay) {
        rt.historian.setSpeed(replay.id, m.value);
      } else if (m.cmd === 'replay-seek' && typeof m.value === 'number' && replay) {
        const range = rt.historian.dataRange();
        if (range) {
          const f = Date.parse(range.from);
          const t = Date.parse(range.to);
          rt.historian.seek(replay.id, new Date(f + Math.max(0, Math.min(1, m.value)) * (t - f)).toISOString());
        }
      } else if (m.cmd === 'replay-stop' && replay) {
        rt.historian.closeReplay(replay.id);
        replay = null;
        broadcast(modeMsg());
      }
    });
    ws.on('close', () => {
      subs.delete(ws);
      tokens.delete(ws);
    });
  });

  // Broadcast alarm khi tập alarm hoạt động đổi (report-by-exception).
  let lastAlarmSig = '';
  const broadcastAlarms = (): void => {
    const sig =
      rt.activeAlarms().map((a) => `${a.alarmId}:${a.state}`).join('|') +
      '#' + rt.shelvedAlarms().map((s) => s.alarmId).join('|');
    if (sig === lastAlarmSig) return;
    lastAlarmSig = sig;
    broadcast(alarmsMsg());
  };

  // Broadcast trạng thái SFC live + C&E khi đổi (report-by-exception).
  let lastSeqSig = '';
  let lastCeSig = '';
  const broadcastSeqCe = (): void => {
    const seqSig = JSON.stringify(rt.liveSequenceState());
    if (seqSig !== lastSeqSig) {
      lastSeqSig = seqSig;
      broadcast(JSON.stringify({ type: 'seq-live', active: rt.liveSequenceState() }));
    }
    const ceSig = JSON.stringify(ceStates());
    if (ceSig !== lastCeSig) {
      lastCeSig = ceSig;
      broadcast(ceMsg());
    }
  };

  // Broadcast interlock/permissive đang chặn khi đổi (report-by-exception) — HMI hiện đèn/panel permissive.
  let lastPermSig = '';
  const broadcastPermissives = (): void => {
    const sig = JSON.stringify(rt.activeInterlocks());
    if (sig === lastPermSig) return;
    lastPermSig = sig;
    broadcast(permMsg());
  };

  const sendReplayFrame = (ws: WebSocket, clockMs: number, sess: ReplaySession): void => {
    const sub = subs.get(ws);
    if (!sub) return;
    const values: Record<string, number> = {};
    for (const [t, p] of Object.entries(rt.historian.frameAt(clockMs, sub.tags))) values[t] = Math.round(p.value * 100) / 100;
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delta', mode: 'REPLAY', replay: sess, values }));
  };

  let kpiTick = 0;
  const timer = setInterval(() => {
    rt.step(); // live luôn chạy + ghi historian, kể cả khi đang replay
    if (replay) {
      const clockTs = rt.historian.advanceReplay(replay.id, stepMs);
      const sess = rt.historian.session(replay.id);
      if (clockTs && sess) {
        const clockMs = Date.parse(clockTs);
        for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) sendReplayFrame(ws, clockMs, sess);
      }
    } else {
      for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) sendScreen(ws, false);
      broadcastAlarms();
      broadcastSeqCe();
      broadcastPermissives();
      if (++kpiTick % 50 === 0) {
        void rt.computeKpis().then((results) => broadcast(JSON.stringify({ type: 'kpi', results })));
        rt.evaluatePredictive(); // cập nhật cảnh báo bảo trì dự đoán trước khi broadcast
        broadcast(maintMsg());
      }
    }
  }, stepMs);

  // (5) Persistence + Sparkplug — BẬT khi có env; base run KHÔNG chạm pg/mqtt (startPersistence không được gọi).
  let persistStop: (() => Promise<void>) | undefined;
  if (process.env.IDTP_TIMESCALE_URL || process.env.IDTP_MQTT_URL) {
    void startPersistence(rt, { timescaleUrl: process.env.IDTP_TIMESCALE_URL, mqttUrl: process.env.IDTP_MQTT_URL })
      .then((stop) => {
        persistStop = stop;
        console.log('[persist] BẬT — Timescale:', !!process.env.IDTP_TIMESCALE_URL, '· Sparkplug:', !!process.env.IDTP_MQTT_URL);
      })
      .catch((e) => console.error('[persist] lỗi kết nối, bỏ qua:', e?.message ?? e));
  }

  // (6) Field I/O southbound (OPC-UA/Modbus) — BẬT khi có env; base run KHÔNG chạm (0 hồi quy). Không có
  // driver thật (deps.makeDriver) → NGẮT KẾT NỐI (mẫu inbound rỗng, không bịa); cắm driver khi có credential.
  let fieldStop: (() => Promise<void>) | undefined;
  if (process.env.IDTP_FIELD_PROTOCOL) {
    let points: FieldPoint[] = [];
    try {
      points = JSON.parse(process.env.IDTP_FIELD_POINTS ?? '[]') as FieldPoint[];
    } catch {
      points = [];
    }
    const fieldProto = process.env.IDTP_FIELD_PROTOCOL as FieldProtocol;
    void startFieldLink(
      { protocol: fieldProto, endpoint: process.env.IDTP_FIELD_ENDPOINT, points },
      fieldProto === 'modbus-tcp' ? { makeDriver: makeModbusTcpDriver } : {},
    )
      .then((link) => {
        fieldStop = link.stop;
        fieldLink = link;
        console.log('[field-io]', link.status().notice.vi);
      })
      .catch((e) => console.error('[field-io] lỗi, bỏ qua:', e?.message ?? e));
  }

  const ready = new Promise<number>((resolve) => {
    server.listen(port, () => resolve((server.address() as AddressInfo).port));
  });
  const close = (): Promise<void> =>
    new Promise<void>((resolve) => {
      clearInterval(timer);
      void persistStop?.();
      void fieldStop?.();
      wss.close(() => server.close(() => resolve()));
    });

  return { server, wss, ready, close };
}

// chạy trực tiếp: node dist/server.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 8080;
  const app = startServer(port, { stepMs: 100 });
  void app.ready.then((p) => {
    // eslint-disable-next-line no-console
    console.log(`IDTP thermal-runtime: http://localhost:${p}`);
  });
}
