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

    // lệnh tải 400 MW (setpoint → xác nhận 2 bước) → MW giảm khỏi 448
    ws.send(JSON.stringify({ cmd: 'load', value: 400, confirm: true }));
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

  it('DATA REPLAY: stream frame lịch sử (mode REPLAY) + chặn cứng lệnh ra thiết bị', async () => {
    const app = startServer(0, { stepMs: 10 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: { type?: string; mode?: string; reason?: string }[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as { type?: string; mode?: string }));
    await new Promise<void>((r) => ws.on('open', () => r()));
    ws.send(JSON.stringify({ cmd: 'screen', screenId: 'D1-plant-overview' }));
    await sleep(600); // tích luỹ dữ liệu historian

    ws.send(JSON.stringify({ cmd: 'replay-start' }));
    let modeReplay = false;
    let deltaReplay = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 2000 && !(modeReplay && deltaReplay)) {
      await sleep(20);
      modeReplay = msgs.some((m) => m.type === 'mode' && m.mode === 'REPLAY');
      deltaReplay = msgs.some((m) => m.type === 'delta' && m.mode === 'REPLAY');
    }
    expect(modeReplay).toBe(true);
    expect(deltaReplay).toBe(true);

    // lệnh ra thiết bị khi replay → blocked
    const mark = msgs.length;
    ws.send(JSON.stringify({ cmd: 'load', value: 400 }));
    let blocked = false;
    const t1 = Date.now();
    while (Date.now() - t1 < 1000 && !blocked) {
      await sleep(20);
      blocked = msgs.slice(mark).some((m) => m.type === 'blocked');
    }
    expect(blocked).toBe(true);

    // thoát replay → LIVE
    ws.send(JSON.stringify({ cmd: 'replay-stop' }));
    let live = false;
    const t2 = Date.now();
    while (Date.now() - t2 < 1000 && !live) {
      await sleep(20);
      live = msgs.filter((m) => m.type === 'mode').pop()?.mode === 'LIVE';
    }
    expect(live).toBe(true);

    ws.close();
    await app.close();
  });

  it('RBAC: auth khi kết nối · setpoint cần xác nhận 2 bước · Viewer bị từ chối · audit ghi lệnh', async () => {
    interface Msg {
      type?: string;
      ok?: boolean;
      roles?: string[];
      action?: string;
      reason?: string;
      entries?: { action?: string; newValue?: unknown }[];
    }
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: Msg[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as Msg));
    const until = async (fn: () => boolean): Promise<boolean> => {
      const t0 = Date.now();
      while (Date.now() - t0 < 2000) {
        if (fn()) return true;
        await sleep(20);
      }
      return false;
    };
    await new Promise<void>((r) => ws.on('open', () => r()));

    expect(await until(() => msgs.some((m) => m.type === 'auth' && m.ok === true))).toBe(true);
    expect(msgs.filter((m) => m.type === 'auth').pop()?.roles).toContain('Operator');

    ws.send(JSON.stringify({ cmd: 'load', value: 460 }));
    expect(await until(() => msgs.some((m) => m.type === 'confirm-needed' && m.action === 'setpoint'))).toBe(true);

    ws.send(JSON.stringify({ cmd: 'load', value: 460, confirm: true }));
    await sleep(150);
    ws.send(JSON.stringify({ cmd: 'audit-query' }));
    expect(await until(() => (msgs.filter((m) => m.type === 'audit').pop()?.entries?.length ?? 0) > 0)).toBe(true);
    const audit = msgs.filter((m) => m.type === 'audit').pop();
    expect(audit?.entries?.some((e) => e.action === 'setpoint' && e.newValue === 460)).toBe(true);

    ws.send(JSON.stringify({ cmd: 'login', user: 'viewer' }));
    expect(await until(() => (msgs.filter((m) => m.type === 'auth').pop()?.roles?.includes('Viewer') ?? false))).toBe(true);
    const mark = msgs.length;
    ws.send(JSON.stringify({ cmd: 'load', value: 470, confirm: true }));
    expect(await until(() => msgs.slice(mark).some((m) => m.type === 'denied'))).toBe(true);

    ws.close();
    await app.close();
  });

  it('OTS: Engineer freeze được (action engineer); Operator bị từ chối', async () => {
    interface Msg {
      type?: string;
      roles?: string[];
      frozen?: boolean;
    }
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs: Msg[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as Msg));
    const until = async (fn: () => boolean): Promise<boolean> => {
      const t0 = Date.now();
      while (Date.now() - t0 < 2000) {
        if (fn()) return true;
        await sleep(20);
      }
      return false;
    };
    await new Promise<void>((r) => ws.on('open', () => r()));

    // mặc định Operator → OTS freeze (action engineer) bị từ chối
    ws.send(JSON.stringify({ cmd: 'ots-freeze', value: 1 }));
    expect(await until(() => msgs.some((m) => m.type === 'denied'))).toBe(true);

    // đổi vai Engineer → freeze được → nhận ots frozen=true
    ws.send(JSON.stringify({ cmd: 'login', user: 'engineer' }));
    expect(await until(() => msgs.filter((m) => m.type === 'auth').pop()?.roles?.includes('Engineer') ?? false)).toBe(true);
    const mark = msgs.length;
    ws.send(JSON.stringify({ cmd: 'ots-freeze', value: 1 }));
    expect(await until(() => msgs.slice(mark).some((m) => m.type === 'ots' && m.frozen === true))).toBe(true);

    ws.close();
    await app.close();
  });
});
