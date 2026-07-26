// apps/thermal-runtime server — chạy vòng CCS khép kín, phục vụ màn hình KHAI BÁO của plugin
// (D1 + D3) và stream tag theo TỪNG màn hình (subscribe-by-screen, report-by-exception) qua WS.
// Màn hình là JSON khai báo; client render generic theo symbol. Không hardcode màn hình process.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { ScreenDef } from '@idtp/sdk';
import { boilerScreens, screenTags } from '@idtp/plugin-thermal-power-600';
import { createThermalRuntime } from './runtime';

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
  value?: number;
}

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

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let m: Command;
      try {
        m = JSON.parse(data.toString()) as Command;
      } catch {
        return;
      }
      if (m.cmd === 'screen' && m.screenId !== undefined && screensById.has(m.screenId)) {
        const scr = screensById.get(m.screenId);
        if (scr) {
          subs.set(ws, { tags: screenTags(scr), last: new Map() });
          sendScreen(ws, true); // snapshot đầy đủ khi vào màn hình
        }
      } else if (m.cmd === 'load' && typeof m.value === 'number') {
        rt.setLoadDemand(m.value);
      } else if (m.cmd === 'mill-trip') {
        rt.injectMalfunction({ id: 'mill-trip' });
      }
    });
    ws.on('close', () => subs.delete(ws));
  });

  const timer = setInterval(() => {
    rt.step();
    for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) sendScreen(ws, false);
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
