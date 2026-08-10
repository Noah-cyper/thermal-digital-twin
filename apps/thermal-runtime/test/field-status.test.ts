import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../src/server';

interface Msg {
  type: string;
  [k: string]: unknown;
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
async function conn(port: number): Promise<{ ws: WebSocket; msgs: Msg[] }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as Msg));
  await new Promise<void>((r) => ws.on('open', () => r()));
  return { ws, msgs };
}
async function waitFor(msgs: Msg[], pred: (m: Msg) => boolean, ms = 3000): Promise<Msg | undefined> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = [...msgs].reverse().find(pred);
    if (hit) return hit;
    await sleep(20);
  }
  return undefined;
}

describe('field-status WS command (southbound field I/O)', () => {
  it('base run (không IDTP_FIELD_PROTOCOL) → chưa bật, ngắt kết nối, 0 mẫu', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);

    ws.send(JSON.stringify({ cmd: 'field-status' }));
    const m = await waitFor(msgs, (x) => x.type === 'field-status');

    expect(m).toBeDefined();
    expect(m?.enabled).toBe(false); // field-link không được gọi khi không có env
    expect(m?.samples).toBe(0);
    expect(m?.status).toBeNull();

    ws.close();
    await app.close();
  });
});
