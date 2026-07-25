// Walking skeleton server (Pha A W4) — chạy vòng kín skeleton, phát tag delta qua WebSocket,
// phục vụ 1 màn hình SVG (screen.json). Đây là "nhìn thấy trên browser".
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { createSkeleton } from './skeleton';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUBLIC = join(ROOT, 'public');
const SCREENS = join(ROOT, 'screens');

// tag hiển thị trên màn hình D3 Steam Drum
const TAGS = ['BLR_DRUM_LEVEL_01', 'BLR_STEAM_FLOW_01', 'BLR_FW_FLOW_01', 'BLR_FW_CV_01', 'BLR_STEAM_DEMAND'];

export interface RunningServer {
  server: http.Server;
  wss: WebSocketServer;
  ready: Promise<number>;
  close(): Promise<void>;
}

interface Command {
  cmd?: string;
  value?: number;
}

export function startServer(port = 8080, opts: { stepMs?: number } = {}): RunningServer {
  const stepMs = opts.stepMs ?? 100;
  const skeleton = createSkeleton();

  const server = http.createServer((req, res) => {
    try {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(join(PUBLIC, 'index.html')));
      } else if (req.url === '/screen.json') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(readFileSync(join(SCREENS, 'steam-drum.screen.json')));
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
        if (m.cmd === 'steam' && typeof m.value === 'number') skeleton.setSteamDemand(m.value);
        else if (m.cmd === 'leak' && typeof m.value === 'number') skeleton.injectTubeLeak(m.value);
      } catch {
        // bỏ qua message xấu
      }
    });
  });

  const timer = setInterval(() => {
    skeleton.step();
    const values: Record<string, number> = {};
    for (const t of TAGS) {
      const v = skeleton.tag.getCurrent(t);
      if (typeof v?.value === 'number') values[t] = Math.round(v.value * 100) / 100;
    }
    const msg = JSON.stringify(values);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
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
    console.log(`IDTP walking skeleton: http://localhost:${p}`);
  });
}
