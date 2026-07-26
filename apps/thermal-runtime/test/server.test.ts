import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../src/server';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
interface Delta {
  type: string;
  values: Record<string, number>;
}

describe('thermal-runtime server', () => {
  it('phục vụ registry + screen.json + stream tag theo màn hình; lệnh tải đổi MW', async () => {
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;

    // HTTP: registry + 1 screen + 404 + trang HTML
    const reg = (await (await fetch(`http://127.0.0.1:${port}/screens`)).json()) as { screenId: string }[];
    expect(reg.some((s) => s.screenId === 'D1-plant-overview')).toBe(true);
    const scr = (await (await fetch(`http://127.0.0.1:${port}/screen/D1-plant-overview`)).json()) as { screenId: string };
    expect(scr.screenId).toBe('D1-plant-overview');
    expect((await fetch(`http://127.0.0.1:${port}/screen/nope`)).status).toBe(404);
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain('CCS runtime');

    // WS: subscribe D1 → nhận delta có GEN_MW_01
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: Delta[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as Delta));
    await new Promise<void>((r) => ws.on('open', () => r()));
    ws.send(JSON.stringify({ cmd: 'screen', screenId: 'D1-plant-overview' }));

    let got = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 2000) {
      await sleep(20);
      if (msgs.some((m) => m.type === 'delta' && 'GEN_MW_01' in m.values)) {
        got = true;
        break;
      }
    }
    expect(got).toBe(true);

    // lệnh tải 400 MW → MW giảm khỏi 448
    ws.send(JSON.stringify({ cmd: 'load', value: 400 }));
    let mw = 999;
    const t1 = Date.now();
    while (Date.now() - t1 < 4000) {
      await sleep(20);
      const m = msgs.filter((x) => x.type === 'delta' && typeof x.values.GEN_MW_01 === 'number').pop();
      if (m) mw = m.values.GEN_MW_01 as number;
      if (mw < 435) break;
    }
    expect(mw).toBeLessThan(440);

    ws.close();
    await app.close();
  });

  it('gửi snapshot alarm khi kết nối; lệnh ack/leak không gây lỗi', async () => {
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const alarmMsgs: { active: unknown[] }[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as { type?: string; active?: unknown[] };
      if (m.type === 'alarms' && m.active) alarmMsgs.push({ active: m.active });
    });
    await new Promise<void>((r) => ws.on('open', () => r()));

    const t0 = Date.now();
    while (alarmMsgs.length === 0 && Date.now() - t0 < 2000) await sleep(20);
    expect(alarmMsgs.length).toBeGreaterThan(0);
    expect(Array.isArray(alarmMsgs[0]?.active)).toBe(true);

    ws.send(JSON.stringify({ cmd: 'ack', alarmId: 'BLR-DRUM-LVL-HH' }));
    ws.send(JSON.stringify({ cmd: 'leak', value: 0 }));
    await sleep(100);

    ws.close();
    await app.close();
  });
});
