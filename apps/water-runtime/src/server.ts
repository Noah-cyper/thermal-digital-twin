// apps/water-runtime server — chạy vòng kín plugin #2 (water-treatment), phát tag delta + alarm qua WebSocket,
// phục vụ HMI nước (readout bể + màng RO + panel alarm + nút sự cố). Cùng khuôn thermal-runtime, nhà máy KHÁC.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { createWaterRuntime, WATER_TAGS } from './runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');

export interface RunningServer {
  server: http.Server;
  wss: WebSocketServer;
  ready: Promise<number>;
  close(): Promise<void>;
}

interface Command {
  cmd?: string;
  value?: number;
  malf?: string;
}

// Bản đồ lệnh nút → malfunction id (ra thiết bị mô phỏng).
const MALFS = new Set(['tank-leak', 'pump-a-trip', 'membrane-fouling', 'membrane-breach']);

export function startServer(port = 8090, opts: { stepMs?: number } = {}): RunningServer {
  const stepMs = opts.stepMs ?? 100;
  const rt = createWaterRuntime();

  const server = http.createServer((req, res) => {
    try {
      const url = req.url ?? '/';
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(join(PUBLIC, 'index.html')));
      } else if (url === '/screens') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rt.screens()));
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    } catch {
      res.writeHead(500);
      res.end('server error');
    }
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString()) as Command;
        if (m.cmd === 'demand' && typeof m.value === 'number') rt.setDemand(m.value);
        else if (m.cmd === 'malf' && typeof m.malf === 'string' && MALFS.has(m.malf)) {
          if (m.value === 0) rt.clearMalfunction(m.malf);
          else rt.injectMalfunction({ id: m.malf });
        }
      } catch {
        // bỏ qua message xấu
      }
    });
  });

  const timer = setInterval(() => {
    rt.step();
    const values: Record<string, number> = {};
    for (const t of WATER_TAGS) values[t] = Math.round(rt.value(t) * 100) / 100;
    const alarms = rt.activeAlarms().map((a) => ({ alarmId: a.alarmId, priority: a.priority, state: a.state }));
    const msg = JSON.stringify({ values, alarms });
    for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(msg);
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

// chạy trực tiếp: node dist/server.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 8090;
  const app = startServer(port, { stepMs: 100 });
  void app.ready.then((p) => {
    // eslint-disable-next-line no-console
    console.log(`IDTP water-runtime (plugin #2): http://localhost:${p}`);
  });
}
