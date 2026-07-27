// apps/thermal-runtime server — chạy vòng CCS khép kín, phục vụ màn hình KHAI BÁO của plugin
// (D1 + D3) và stream tag theo TỪNG màn hình (subscribe-by-screen, report-by-exception) qua WS.
// Màn hình là JSON khai báo; client render generic theo symbol. Không hardcode màn hình process.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { ScreenDef, PermissionAction, Role } from '@idtp/sdk';
import type { ReplaySession } from '@idtp/engines';
import { SecurityEngine } from '@idtp/engines';
import { boilerScreens, screenTags } from '@idtp/plugin-thermal-power-600';
import { createThermalRuntime } from './runtime';

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
const CMD_ACTION: Record<string, PermissionAction> = { load: 'setpoint', ack: 'ack', leak: 'override', 'mill-trip': 'override' };

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
}

const LIVE_CMDS = new Set(['load', 'leak', 'mill-trip', 'ack']); // lệnh ra thiết bị — chặn khi replay

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
    const target = cmd === 'ack' ? m.alarmId ?? '' : cmd === 'load' ? 'BLR_MW_DEMAND' : cmd === 'leak' ? 'tube-leak' : 'mill';
    const oldVal = cmd === 'load' ? rt.value('BLR_MW_DEMAND') : undefined;
    const newVal = cmd === 'load' ? m.value : cmd === 'leak' ? m.value : cmd === 'ack' ? m.alarmId : 'trip';

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
    } else if (cmd === 'ack' && m.alarmId !== undefined) rt.ackAlarm(m.alarmId, sec.resolve(access)?.userId ?? 'operator');
  };

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress ?? '?';
    const initial = sec.authenticate('operator', 'p', clientIp); // auto-login vai Operator để dùng ngay
    if ('access' in initial) tokens.set(ws, initial.access);
    ws.send(alarmsMsg());
    ws.send(modeMsg());
    ws.send(authMsg(ws));

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

  const sendReplayFrame = (ws: WebSocket, clockMs: number, sess: ReplaySession): void => {
    const sub = subs.get(ws);
    if (!sub) return;
    const values: Record<string, number> = {};
    for (const [t, p] of Object.entries(rt.historian.frameAt(clockMs, sub.tags))) values[t] = Math.round(p.value * 100) / 100;
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delta', mode: 'REPLAY', replay: sess, values }));
  };

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
