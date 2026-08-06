import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { createThermalRuntime } from '../src/runtime';
import { startServer } from '../src/server';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('thermal-runtime — alarm rationalization (ISA-18.2, B)', () => {
  it('tag ALM_RAT_* sống trong runtime; báo cáo có master + phân bố', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 50; i++) rt.step();
    expect(rt.value('ALM_RAT_COVERAGE_01')).toBe(100);
    expect(rt.value('ALM_RAT_UNRAT_01')).toBe(0);
    expect(rt.value('ALM_RAT_P1_SHARE_01')).toBeGreaterThan(10); // subset an toàn nặng P1
    expect(rt.value('ALM_RAT_DIST_OK_01')).toBe(0); // phân bố chưa đạt EEMUA (trung thực)

    const rep = rt.alarmRationalization();
    expect(rep.master.length).toBe(rep.total);
    expect(rep.master[0]).toHaveProperty('cause');
    expect(rep.master[0]).toHaveProperty('responseTimeSec');
    expect(rep.reviewed).toBe(rep.total);
  });

  it('màn D2-alarm-rationalization có trong screens + nav; mọi tag sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D2-alarm-rationalization');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D2-alarm-rationalization')).toBe(true);
    if (!scr) return;
    const rt = createThermalRuntime();
    for (let i = 0; i < 50; i++) rt.step();
    for (const t of screenTags(scr)) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
  });

  it('WS command alarm-rationalization: trả báo cáo master (read-only, Operator)', async () => {
    const app = startServer(0, { stepMs: 12 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: Array<{ type: string; [k: string]: unknown }> = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    await new Promise<void>((r) => ws.on('open', () => r()));
    await sleep(150);

    ws.send(JSON.stringify({ cmd: 'alarm-rationalization' }));
    const t0 = Date.now();
    let hit: { report?: { master?: unknown[]; coveragePct?: number } } | undefined;
    while (Date.now() - t0 < 2000 && !hit) {
      hit = msgs.find((m) => m.type === 'alarm-rationalization') as typeof hit;
      if (!hit) await sleep(20);
    }
    expect(hit).toBeDefined();
    expect(Array.isArray(hit?.report?.master)).toBe(true);
    expect(hit?.report?.coveragePct).toBe(100);

    ws.close();
    await app.close();
  });
});
