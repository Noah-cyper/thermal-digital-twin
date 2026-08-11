import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../src/server';

// Phủ các command handler WS chưa được test (lift coverage server.ts): read-only · privileged (admin) ·
// replay · login-fail · nhánh persistence env. Server auto-login Operator khi kết nối.
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

describe('thermal-runtime server — command handlers (coverage)', () => {
  it('read-only (Operator auto-login): maintenance/nav/permissive/faceplate/trend/report/journal/diag/audit/advise/resim', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(400); // warmup historian có dữ liệu

    send(ws, { cmd: 'maintenance-query' });
    send(ws, { cmd: 'nav-query' });
    send(ws, { cmd: 'permissive-query' });
    send(ws, { cmd: 'faceplate-list' });
    expect(await waitFor(msgs, (m) => m.type === 'maint')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'nav')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'permissives')).toBeDefined();
    const fp = await waitFor(msgs, (m) => m.type === 'fp-list');
    expect(fp).toBeDefined();
    const assetId = ((fp as { items?: Array<{ assetId: string }> }).items ?? [])[0]?.assetId ?? 'PID-DRUM-LEVEL';

    send(ws, { cmd: 'faceplate-open', assetId });
    send(ws, { cmd: 'faceplate-trend', assetId, hours: 1 });
    send(ws, { cmd: 'trend', tags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01'], hours: 1 });
    send(ws, { cmd: 'report', hours: 8 });
    send(ws, { cmd: 'journal' });
    send(ws, { cmd: 'diag' });
    send(ws, { cmd: 'audit-query' });
    send(ws, { cmd: 'advise', alarmId: 'BLR-DRUM-LVL-HH' });
    send(ws, { cmd: 'resim', value: 400 });
    send(ws, { cmd: 'resim', malf: 'loss-of-vacuum' });
    send(ws, { cmd: 'ai-fleet' });
    send(ws, { cmd: 'ai-assess', assetId: 'BFP' });
    send(ws, { cmd: 'ai-diagnose', assetId: 'BFP' });
    send(ws, { cmd: 'ai-history', assetId: 'BFP', hours: 1 });

    const aiFleet = await waitFor(msgs, (m) => m.type === 'ai-fleet');
    expect(aiFleet).toBeDefined();
    expect((aiFleet as { overview?: { assets?: unknown[] } }).overview?.assets?.length).toBeGreaterThanOrEqual(18);
    const aiAssess = await waitFor(msgs, (m) => m.type === 'ai-assess' && (m as { assetId?: string }).assetId === 'BFP');
    expect((aiAssess as { assessment?: { rul?: { simulated?: boolean } } }).assessment?.rul?.simulated).toBe(true);
    expect(await waitFor(msgs, (m) => m.type === 'ai-diagnose')).toBeDefined();
    const aiHist = await waitFor(msgs, (m) => m.type === 'ai-history' && (m as { assetId?: string }).assetId === 'BFP');
    expect(Array.isArray((aiHist as { series?: unknown[] }).series)).toBe(true);
    expect(await waitFor(msgs, (m) => m.type === 'fp-data')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'fp-trend')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'trend-series')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'report')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'journal')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'diag')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'audit')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'advice')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'resim')).toBeDefined();

    ws.close();
    await app.close();
  });

  it('lệnh Operator: shelve/unshelve (ack) · set-mode (MAN, mode) · override mill-trip bị DENIED (thiếu quyền)', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(200);

    send(ws, { cmd: 'shelve', alarmId: 'SB-FOULING-HI', durationMin: 60, reason: 'coverage test' });
    expect(await waitFor(msgs, (m) => m.type === 'alarms' && Array.isArray((m as { shelved?: unknown[] }).shelved) && ((m as { shelved: unknown[] }).shelved).length > 0)).toBeDefined();
    send(ws, { cmd: 'unshelve', alarmId: 'SB-FOULING-HI' });
    await sleep(150);

    send(ws, { cmd: 'set-mode', loopId: 'drum-level', mode: 'MAN', confirm: true });
    send(ws, { cmd: 'set-mode', loopId: 'drum-level', mode: 'BADMODE' });
    expect(await waitFor(msgs, (m) => m.type === 'denied' && /mode không hợp lệ/.test(String((m as { reason?: string }).reason)))).toBeDefined();

    // Operator KHÔNG có override → mill-trip bị từ chối.
    send(ws, { cmd: 'mill-trip', confirm: true });
    expect(await waitFor(msgs, (m) => m.type === 'denied')).toBeDefined();

    ws.close();
    await app.close();
  });

  it('lệnh privileged (login admin): create-wo · seq-live-start · ce-reset · build-screen (valid + lỗi) · OTS · override malf/leak/vacuum', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(200);
    send(ws, { cmd: 'login', user: 'admin' });
    expect(await waitFor(msgs, (m) => m.type === 'auth' && (m as { ok?: boolean }).ok === true)).toBeDefined();

    send(ws, { cmd: 'create-wo', assetId: 'UNIT1', woType: 'CM', reason: 'coverage' });
    send(ws, { cmd: 'ce-reset', matrixId: 'boiler-mft' });
    send(ws, { cmd: 'build-screen', spec: { screenId: 'D3-cov-demo', level: 'D3', title: { vi: 'cov', en: 'cov' }, tiles: [{ tag: 'GEN_MW_01', label: 'MW', kind: 'value' }] } });
    send(ws, { cmd: 'build-screen' }); // thiếu spec → denied
    send(ws, { cmd: 'ots-snapshot', value: 1 });
    send(ws, { cmd: 'ots-freeze', value: 1 });
    send(ws, { cmd: 'ots-freeze', value: 0 });
    send(ws, { cmd: 'ots-restore', value: 1 });
    send(ws, { cmd: 'malf', malf: 'tube-leak', value: 1, confirm: true });
    send(ws, { cmd: 'malf', malf: 'tube-leak', value: 0, confirm: true });
    send(ws, { cmd: 'leak', value: 0, confirm: true });
    send(ws, { cmd: 'vacuum', value: 6, confirm: true });
    send(ws, { cmd: 'seq-live-start', sequenceId: 'boiler-purge' });

    expect(await waitFor(msgs, (m) => m.type === 'built-screen')).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'denied' && /spec/.test(String((m as { reason?: string }).reason)))).toBeDefined();
    expect(await waitFor(msgs, (m) => m.type === 'ots' || m.type === 'maint')).toBeDefined();

    ws.close();
    await app.close();
  });

  it('replay: start → lệnh ra thiết bị bị chặn → speed/seek → stop', async () => {
    const app = startServer(0, { stepMs: 10 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    await sleep(500); // tích luỹ historian để có dataRange

    send(ws, { cmd: 'replay-start' });
    expect(await waitFor(msgs, (m) => m.type === 'mode' && (m as { mode?: string }).mode === 'REPLAY')).toBeDefined();
    send(ws, { cmd: 'load', value: 400, confirm: true }); // LIVE_CMD trong replay → blocked
    expect(await waitFor(msgs, (m) => m.type === 'blocked' && /REPLAY/.test(String((m as { reason?: string }).reason)))).toBeDefined();
    send(ws, { cmd: 'replay-speed', value: 4 });
    send(ws, { cmd: 'replay-seek', value: 0.5 });
    await sleep(100);
    send(ws, { cmd: 'replay-stop' });
    expect(await waitFor(msgs, (m) => m.type === 'mode' && (m as { mode?: string }).mode === 'LIVE')).toBeDefined();

    ws.close();
    await app.close();
  });

  it('login sai user → auth ok=false; JSON rác bị bỏ qua (không crash)', async () => {
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const { ws, msgs } = await conn(port);
    ws.send('{ this is not json');
    send(ws, { cmd: 'login', user: 'khong-ton-tai' });
    expect(await waitFor(msgs, (m) => m.type === 'auth' && (m as { ok?: boolean }).ok === false)).toBeDefined();
    ws.close();
    await app.close();
  });

  it('nhánh persistence env (pg/mqtt chưa cài → import động throw → .catch, server vẫn phục vụ)', async () => {
    process.env.IDTP_TIMESCALE_URL = 'postgres://x:y@127.0.0.1:1/db';
    process.env.IDTP_MQTT_URL = 'mqtt://127.0.0.1:1';
    try {
      const app = startServer(0, { stepMs: 50 });
      const port = await app.ready;
      expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain('CCS runtime');
      await sleep(200); // để startPersistence chạy tới .catch
      await app.close();
    } finally {
      delete process.env.IDTP_TIMESCALE_URL;
      delete process.env.IDTP_MQTT_URL;
    }
  });
});
