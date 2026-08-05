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
    // màn hình catalog §10 (breadth) cũng được phục vụ
    const cat = (await (await fetch(`http://127.0.0.1:${port}/screen/D2-boiler`)).json()) as { screenId: string };
    expect(cat.screenId).toBe('D2-boiler');
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

  it('Faceplate: fp-list + fp-data; set-mode 2 bước (Operator ok, Viewer bị từ chối)', async () => {
    interface Msg {
      type?: string;
      assetId?: string;
      action?: string;
      roles?: string[];
      items?: { assetId?: string }[];
      data?: unknown;
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

    ws.send(JSON.stringify({ cmd: 'faceplate-list' }));
    expect(await until(() => msgs.some((m) => m.type === 'fp-list' && (m.items ?? []).some((i) => i.assetId === 'PID-DRUM-LEVEL')))).toBe(true);
    ws.send(JSON.stringify({ cmd: 'faceplate-open', assetId: 'PID-DRUM-LEVEL' }));
    expect(await until(() => msgs.some((m) => m.type === 'fp-data' && m.assetId === 'PID-DRUM-LEVEL' && m.data != null))).toBe(true);

    // set-mode cần xác nhận 2 bước
    ws.send(JSON.stringify({ cmd: 'set-mode', loopId: 'drum-level', mode: 'MAN' }));
    expect(await until(() => msgs.some((m) => m.type === 'confirm-needed' && m.action === 'mode'))).toBe(true);
    ws.send(JSON.stringify({ cmd: 'set-mode', loopId: 'drum-level', mode: 'MAN', confirm: true }));
    await sleep(120);

    // Viewer → set-mode bị từ chối
    ws.send(JSON.stringify({ cmd: 'login', user: 'viewer' }));
    expect(await until(() => (msgs.filter((m) => m.type === 'auth').pop()?.roles?.includes('Viewer') ?? false))).toBe(true);
    const mark = msgs.length;
    ws.send(JSON.stringify({ cmd: 'set-mode', loopId: 'drum-level', mode: 'AUTO', confirm: true }));
    expect(await until(() => msgs.slice(mark).some((m) => m.type === 'denied'))).toBe(true);

    ws.close();
    await app.close();
  });

  it('Navigation: gửi cây điều hướng + alarm index khi kết nối', async () => {
    interface NavMsg {
      type?: string;
      tree?: { level?: string }[];
      alarmIndex?: Record<string, string>;
    }
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const navs: NavMsg[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as NavMsg;
      if (m.type === 'nav') navs.push(m);
    });
    await new Promise<void>((r) => ws.on('open', () => r()));

    const t0 = Date.now();
    while (navs.length === 0 && Date.now() - t0 < 2000) await sleep(20);
    expect(navs.length).toBeGreaterThan(0);
    expect((navs[0]?.tree ?? []).some((n) => n.level === 'D1')).toBe(true);
    // alarm→màn chi tiết D3 được gửi kèm khi kết nối (đích cụ thể + bất biến "chứa tag" test ở navigation.test.ts)
    expect(navs[0]?.alarmIndex?.['BLR-DRUM-LVL-HH']).toMatch(/^D3-/);

    ws.close();
    await app.close();
  });

  it('Registry §10: gửi summary (≥ 3.000 tag / ≥ 600 alarm) khi kết nối', async () => {
    interface RegMsg {
      type?: string;
      summary?: { tags?: number; alarms?: number; screens?: number; loops?: number; sequences?: number; scenarios?: number; ceMatrices?: number; byCell?: Record<string, number> };
    }
    const app = startServer(0, { stepMs: 15 });
    const port = await app.ready;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const regs: RegMsg[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as RegMsg;
      if (m.type === 'registry') regs.push(m);
    });
    await new Promise<void>((r) => ws.on('open', () => r()));

    const t0 = Date.now();
    while (regs.length === 0 && Date.now() - t0 < 2000) await sleep(20);
    expect(regs.length).toBeGreaterThan(0);
    expect(regs[0]?.summary?.tags ?? 0).toBeGreaterThanOrEqual(3000);
    expect(regs[0]?.summary?.alarms ?? 0).toBeGreaterThanOrEqual(600);
    expect(regs[0]?.summary?.screens ?? 0).toBeGreaterThanOrEqual(70);
    expect(regs[0]?.summary?.loops ?? 0).toBeGreaterThanOrEqual(25);
    expect(regs[0]?.summary?.sequences ?? 0).toBeGreaterThanOrEqual(8);
    expect(regs[0]?.summary?.scenarios ?? 0).toBeGreaterThanOrEqual(1);
    expect(regs[0]?.summary?.ceMatrices ?? 0).toBeGreaterThanOrEqual(2);
    expect(regs[0]?.summary?.byCell?.['boiler']).toBe(600);

    ws.close();
    await app.close();
  });

  it('OTS control: seq-list + ce khi kết nối; seq-live-start chạy chuỗi live', async () => {
    interface Msg {
      type?: string;
      items?: { sequenceId?: string }[];
      matrices?: { matrixId?: string }[];
      active?: { sequenceId?: string }[];
    }
    const app = startServer(0, { stepMs: 12 });
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

    expect(await until(() => msgs.some((m) => m.type === 'seq-list' && (m.items ?? []).length >= 8))).toBe(true);
    expect(await until(() => msgs.some((m) => m.type === 'ce' && (m.matrices ?? []).length === 3))).toBe(true);

    ws.send(JSON.stringify({ cmd: 'login', user: 'engineer' })); // SFC live = action 'engineer'
    await sleep(80);
    ws.send(JSON.stringify({ cmd: 'seq-live-start', sequenceId: 'mill-a-stop' }));
    expect(await until(() => msgs.some((m) => m.type === 'seq-live' && (m.active ?? []).some((a) => a.sequenceId === 'mill-a-stop')))).toBe(true);

    ws.close();
    await app.close();
  });

  it('RE-SIM what-if: lệnh resim trả quỹ đạo nhánh (read-only)', async () => {
    interface Msg {
      type?: string;
      label?: string;
      result?: { trajectory?: { tags?: Record<string, number> }[] };
    }
    const app = startServer(0, { stepMs: 12 });
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
    await sleep(200); // để sim tích luỹ trạng thái

    ws.send(JSON.stringify({ cmd: 'resim', malf: 'loss-of-vacuum' }));
    expect(await until(() => msgs.some((m) => m.type === 'resim' && (m.result?.trajectory ?? []).length > 0))).toBe(true);
    const r = msgs.filter((m) => m.type === 'resim').pop();
    expect(r?.label).toBe('loss-of-vacuum');

    ws.close();
    await app.close();
  });

  it('Screen Builder (L5): Engineer dựng màn hình từ spec → built-screen + phục vụ /screen; Operator bị từ chối', async () => {
    interface Msg {
      type?: string;
      def?: { screenId?: string; elements?: unknown[] };
      items?: string[];
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
    // Builder nhận danh sách tag khi kết nối (nguồn cho picker)
    expect(await until(() => msgs.some((m) => m.type === 'tags' && (m.items ?? []).length > 0))).toBe(true);
    const spec = { screenId: 'D3-test-build', level: 'D3', title: { vi: 't', en: 't' }, tiles: [{ tag: 'GEN_MW_01', label: 'MW' }] };

    // Operator (mặc định) → dựng bị từ chối (action engineer)
    ws.send(JSON.stringify({ cmd: 'build-screen', spec }));
    expect(await until(() => msgs.some((m) => m.type === 'denied'))).toBe(true);

    // Engineer → dựng được → built-screen + /screen phục vụ
    ws.send(JSON.stringify({ cmd: 'login', user: 'engineer' }));
    await sleep(120);
    const mark = msgs.length;
    ws.send(JSON.stringify({ cmd: 'build-screen', spec }));
    expect(await until(() => msgs.slice(mark).some((m) => m.type === 'built-screen' && m.def?.screenId === 'D3-test-build'))).toBe(true);
    const scr = (await (await fetch(`http://127.0.0.1:${port}/screen/D3-test-build`)).json()) as { screenId: string };
    expect(scr.screenId).toBe('D3-test-build');

    ws.close();
    await app.close();
  });
});
