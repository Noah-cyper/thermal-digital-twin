import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../src/server';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('water-runtime server — WS delta + HTTP screens', () => {
  it('phát values + alarms qua WS; HTTP / và /screens phục vụ', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;

    // HTTP
    const home = await fetch(`http://127.0.0.1:${port}/`);
    expect(home.status).toBe(200);
    expect((await home.text())).toContain('Water Treatment');
    const scr = await fetch(`http://127.0.0.1:${port}/screens`);
    expect(scr.status).toBe(200);
    expect(Array.isArray(await scr.json())).toBe(true);
    expect((await (await fetch(`http://127.0.0.1:${port}/nope`)).text())).toBe('not found');

    // WS delta
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: Array<{ values?: Record<string, number>; alarms?: unknown[] }> = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    await new Promise<void>((r) => ws.on('open', () => r()));
    await sleep(300);
    const last = msgs[msgs.length - 1];
    expect(last).toBeDefined();
    expect(typeof last?.values?.WTP_RO_PERMEATE_FLOW_01).toBe('number');
    expect(Array.isArray(last?.alarms)).toBe(true);

    // Command: đổi nhu cầu (không ném)
    ws.send(JSON.stringify({ cmd: 'demand', value: 140 }));
    ws.send(JSON.stringify({ cmd: 'malf', malf: 'membrane-breach', value: 1 }));
    ws.send('{ rác json'); // bỏ qua
    await sleep(150);

    ws.close();
    await app.close();
  });
});
