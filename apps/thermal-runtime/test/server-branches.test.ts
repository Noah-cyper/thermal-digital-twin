import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../src/server';

// Phủ các NHÁNH LỖI/CHẶN còn hở trong server.ts (lift coverage): HTTP routing (200/404),
// shelve/unshelve blockedReason (ISA-18.2), seq-live & ce-reset DENIED khi thiếu quyền engineer,
// build-screen spec lỗi (catch). Server auto-login Operator; login admin để test nhánh privileged.
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
interface Msg {
  type: string;
  [k: string]: unknown;
}
async function conn(port: number): Promise<{ ws: WebSocket; msgs: Msg[] }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as Msg));
  await new Promise<void>((r) => ws.on('open', () => r()));
  return { ws, msgs };
}
function send(ws: WebSocket, o: unknown): void {
  ws.send(JSON.stringify(o));
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

describe('thermal-runtime server — nhánh lỗi/chặn (coverage)', () => {
  it('HTTP: / (html) · /screens (registry) · /screen/<id> (200) · /screen/xxx & /nope (404)', async () => {
    const app = startServer(0, { stepMs: 50 });
    const port = await app.ready;
    const base = `http://127.0.0.1:${port}`;

    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect((await home.text()).length).toBeGreaterThan(0);

    const scrRes = await fetch(`${base}/screens`);
    expect(scrRes.status).toBe(200);
    const registry = (await scrRes.json()) as Array<{ screenId: string }>;
    expect(registry.length).toBeGreaterThan(0);

    const one = await fetch(`${base}/screen/${registry[0].screenId}`);
    expect(one.status).toBe(200);
    expect((await one.json()) as { screenId: string }).toHaveProperty('screenId');

    expect((await fetch(`${base}/screen/khong-ton-tai`)).status).toBe(404);
    expect((await fetch(`${base}/tuyen-duong-la`)).status).toBe(404);

    await app.close();
  });

  it('shelve THIẾU LÝ DO & unshelve alarm KHÔNG shelve → blockedReason (ISA-18.2)', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(200);

    // reason bỏ trống → server dùng '' → alarm-engine chặn 'phải có lý do'.
    send(ws, { cmd: 'shelve', alarmId: 'SB-FOULING-HI', durationMin: 60 });
    expect(await waitFor(msgs, (m) => m.type === 'denied' && /lý do/.test(String((m as { reason?: string }).reason)))).toBeDefined();

    // unshelve alarm chưa từng shelve → 'không ở trạng thái Shelved'.
    send(ws, { cmd: 'unshelve', alarmId: 'SB-FOULING-HI' });
    expect(await waitFor(msgs, (m) => m.type === 'denied' && /Shelved/.test(String((m as { reason?: string }).reason)))).toBeDefined();

    ws.close();
    await app.close();
  });

  it('Operator (thiếu engineer): seq-live-start & ce-reset → DENIED', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(200);

    // boiler-purge không bị interlock chặn ở điểm vận hành → qua interlock, chặn ở RBAC engineer.
    send(ws, { cmd: 'seq-live-start', sequenceId: 'boiler-purge' });
    expect(await waitFor(msgs, (m) => m.type === 'denied')).toBeDefined();

    send(ws, { cmd: 'ce-reset', matrixId: 'boiler-mft' });
    expect(await waitFor(msgs, (m) => m.type === 'denied')).toBeDefined();

    ws.close();
    await app.close();
  });

  it('Admin build-screen SPEC LỖI (tiles rỗng) → nhánh catch "spec lỗi"', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(200);
    send(ws, { cmd: 'login', user: 'admin' });
    expect(await waitFor(msgs, (m) => m.type === 'auth' && (m as { ok?: boolean }).ok === true)).toBeDefined();

    // spec CÓ MẶT (qua '!m.spec') + screenId hợp lệ (qua guardedWrite) nhưng tiles rỗng → buildScreen throw → catch.
    send(ws, { cmd: 'build-screen', spec: { screenId: 'D3-cov-throw', level: 'D3', title: { vi: 'x', en: 'x' }, tiles: [] } });
    expect(await waitFor(msgs, (m) => m.type === 'denied' && /spec lỗi/.test(String((m as { reason?: string }).reason)))).toBeDefined();

    ws.close();
    await app.close();
  });
});
