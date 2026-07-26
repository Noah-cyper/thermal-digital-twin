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
});
