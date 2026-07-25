import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../src/server';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('walking skeleton server', () => {
  it('WS phát tag delta realtime; lệnh steam thay đổi tải', async () => {
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: Record<string, number>[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as Record<string, number>));
    await new Promise<void>((r) => ws.on('open', () => r()));

    const t0 = Date.now();
    while (msgs.length < 5 && Date.now() - t0 < 2000) await sleep(20);
    expect(msgs.length).toBeGreaterThanOrEqual(5);
    const last = msgs[msgs.length - 1];
    expect(last && 'BLR_DRUM_LEVEL_01' in last).toBe(true);

    // gửi lệnh tăng tải → steam flow đổi sang 1800
    ws.send(JSON.stringify({ cmd: 'steam', value: 1800 }));
    const t1 = Date.now();
    let steam = 0;
    while (Date.now() - t1 < 2000) {
      await sleep(20);
      const m = msgs[msgs.length - 1];
      steam = m?.BLR_STEAM_FLOW_01 ?? 0;
      if (steam > 1700) break;
    }
    expect(steam).toBeGreaterThan(1700);

    // HTTP: phục vụ màn hình JSON + trang SVG
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    expect(html).toContain('Walking Skeleton');
    const scr = (await (await fetch(`http://127.0.0.1:${port}/screen.json`)).json()) as { screenId: string };
    expect(scr.screenId).toBe('D3-steam-drum');

    ws.close();
    await app.close();
  });
});
