// apps/thermal-runtime server — chạy vòng CCS khép kín, phục vụ màn hình KHAI BÁO của plugin
// (D1 + D3) và stream tag theo TỪNG màn hình (subscribe-by-screen, report-by-exception) qua WS.
// Màn hình là JSON khai báo; client render generic theo symbol. Không hardcode màn hình process.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { ScreenDef, PermissionAction, Role, LoopMode } from '@idtp/sdk';
import type { ReplaySession } from '@idtp/engines';
import { SecurityEngine } from '@idtp/engines';
import { boilerScreens, screenTags } from '@idtp/plugin-thermal-power-600';
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
const CMD_ACTION: Record<string, PermissionAction> = { load: 'setpoint', ack: 'ack', leak: 'override', 'mill-trip': 'override', vacuum: 'override' };
const LIVE_OTS = new Set(['ots-freeze', 'ots-snapshot', 'ots-restore']); // OTS: action 'engineer'

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
  hours?: number;
  sequenceId?: string;
  matrixId?: string;
}

const LIVE_CMDS = new Set(['load', 'leak', 'mill-trip', 'vacuum', 'ack', 'set-mode', 'seq-live-start', 'ce-reset']); // lệnh ra thiết bị — chặn khi replay
const MODES: ReadonlySet<string> = new Set(['MAN', 'AUTO', 'CASCADE']);

export interface RunningServer {
  server: http.Server;
  wss: WebSocketServer;
  ready: Promise<number>;
  close(): Promise<void>;
}

export function startServer(port = 8080, opts: { stepMs?: number } = {}): RunningServer {
  const stepMs = opts.stepMs ?? 100;
  const rt = createThermalRuntime();
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

  const alarmsMsg = (): string => JSON.stringify({ type: 'alarms', active: rt.activeAlarms(), kpi: rt.alarmKpi() });

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
    const action = CMD_ACTION[cmd] as PermissionAction;
    const target = cmd === 'ack' ? m.alarmId ?? '' : cmd === 'load' ? 'BLR_MW_DEMAND' : cmd === 'leak' ? 'tube-leak' : cmd === 'vacuum' ? 'loss-of-vacuum' : 'mill';
    const oldVal = cmd === 'load' ? rt.value('BLR_MW_DEMAND') : undefined;
    const newVal = cmd === 'load' ? m.value : cmd === 'leak' || cmd === 'vacuum' ? m.value : cmd === 'ack' ? m.alarmId : 'trip';

    let confirmToken: string | undefined;
    if (sec.requiresTwoStep(action)) {
      if (m.confirm !== true) {
        ws.send(JSON.stringify({ type: 'confirm-needed', cmd, value: m.value, alarmId: m.alarmId, action, target }));
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
    else if (cmd === 'leak') {
      if (typeof m.value === 'number' && m.value > 0) rt.injectMalfunction({ id: 'tube-leak', params: { rate: m.value } });
      else rt.clearMalfunction('tube-leak');
    } else if (cmd === 'vacuum') {
      if (typeof m.value === 'number' && m.value > 6) rt.injectMalfunction({ id: 'loss-of-vacuum', params: { kpa: m.value } });
      else rt.clearMalfunction('loss-of-vacuum');
    } else if (cmd === 'ack' && m.alarmId !== undefined) rt.ackAlarm(m.alarmId, sec.resolve(access)?.userId ?? 'operator');
  };

  const maintMsg = (): string =>
    JSON.stringify({ type: 'maint', runtime: rt.maintenanceRuntime(), workOrders: rt.workOrders(), mtbf: rt.maintenanceMtbf('UNIT1') });
  const navMsg = (): string => JSON.stringify({ type: 'nav', tree: rt.navTree(), alarmIndex: rt.navAlarmIndex(), home: rt.navHome() });
  const registryMsg = (): string => JSON.stringify({ type: 'registry', summary: rt.registrySummary() });
  const seqListMsg = (): string => JSON.stringify({ type: 'seq-list', items: rt.sequenceList() });
  const ceStates = (): Array<{ matrixId: string; title: { vi: string; en: string }; state: unknown }> =>
    rt.causeEffectMatrices().map((mx) => ({ matrixId: mx.matrixId, title: mx.title, state: rt.causeEffectState(mx.matrixId) }));
  const ceMsg = (): string => JSON.stringify({ type: 'ce', matrices: ceStates() });

  // Chạy SFC "live" (điều khiển OTS, cùng lớp với freeze) — action 'engineer' (Engineer+), audit, không 2 bước.
  const handleSeqLive = (ws: WebSocket, m: Command): void => {
    const access = tokens.get(ws);
    if (access === undefined) {
      ws.send(JSON.stringify({ type: 'denied', reason: 'chưa đăng nhập' }));
      return;
    }
    const id = m.sequenceId ?? '';
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

    ws.on('message', (data) => {
      let m: Command;
      try {
        m = JSON.parse(data.toString()) as Command;
      } catch {
        return;
      }
      if (m.cmd === 'login') {
        const r = sec.authenticate(m.user ?? 'operator', 'p', clientIp);
        if ('access' in r) {
          tokens.set(ws, r.access);
          ws.send(authMsg(ws));
        } else ws.send(JSON.stringify({ type: 'auth', ok: false, error: r.error }));
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
          subs.set(ws, { tags: screenTags(scr), last: new Map() });
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
    const sig = rt.activeAlarms().map((a) => `${a.alarmId}:${a.state}`).join('|');
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
      if (++kpiTick % 50 === 0) {
        void rt.computeKpis().then((results) => broadcast(JSON.stringify({ type: 'kpi', results })));
        broadcast(maintMsg());
      }
    }
  }, stepMs);

  const ready = new Promise<number>((resolve) => {
    server.listen(port, () => resolve((server.address() as AddressInfo).port));
  });
  const close = (): Promise<void> =>
    new Promise<void>((resolve) => {
      clearInterval(timer);
      wss.close(() => server.close(() => resolve()));
    });

  return { server, wss, ready, close };
}

// chạy trực tiếp: node dist/server.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = startServer(8080, { stepMs: 100 });
  void app.ready.then((p) => {
    // eslint-disable-next-line no-console
    console.log(`IDTP thermal-runtime: http://localhost:${p}`);
  });
}
