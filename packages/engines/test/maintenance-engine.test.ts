import { describe, it, expect } from 'vitest';
import type { MaintenanceItemDef } from '@idtp/sdk';
import { MaintenanceEngine } from '../src/maintenance-engine';

const deps = { formatTs: (ms: number): string => `t${ms}` };
const H = 3_600_000;

describe('MaintenanceEngine (doc 05-18)', () => {
  it('tích giờ chạy + đếm số lần khởi động từ run-state', () => {
    const items: MaintenanceItemDef[] = [{ assetId: 'P1', runTag: 'RUN' }];
    const eng = new MaintenanceEngine(items, deps);
    let run = 0;
    const get = (): number => run;
    eng.sample(get, 0);
    run = 1;
    eng.sample(get, 0); // start (0→1)
    eng.sample(get, 2 * H); // +2 h chạy
    let rt = eng.runtime('P1');
    expect(rt.startCount).toBe(1);
    expect(rt.runningHours).toBeCloseTo(2, 5);
    expect(rt.running).toBe(true);

    run = 0;
    eng.sample(get, 2 * H);
    eng.sample(get, 3 * H); // dừng: không tích thêm
    run = 1;
    eng.sample(get, 3 * H); // khởi động lại
    eng.sample(get, 4 * H); // +1 h
    rt = eng.runtime('P1');
    expect(rt.startCount).toBe(2);
    expect(rt.runningHours).toBeCloseTo(3, 5);
  });

  it('PM tự tạo work order khi vượt ngưỡng giờ chạy', () => {
    const eng = new MaintenanceEngine([{ assetId: 'M', runTag: 'R', pmRunningHours: 2 }], deps);
    eng.sample(() => 1, 0);
    eng.sample(() => 1, 3 * H); // 3 h > 2 h → PM
    expect(eng.workOrders().some((w) => w.type === 'PM' && w.assetId === 'M')).toBe(true);
  });

  it('MTBF = giờ chạy / số lần hỏng', () => {
    const eng = new MaintenanceEngine([{ assetId: 'P', runTag: 'R' }], deps);
    eng.sample(() => 1, 0);
    eng.sample(() => 1, 10 * H); // 10 h
    eng.recordFailure('P', 3 * H);
    eng.recordFailure('P', 7 * H);
    expect(eng.mtbf('P')).toBeCloseTo(5, 5); // 10 / 2
  });

  it('work order vòng đời open→in-progress→done + MTTR (CM)', () => {
    const eng = new MaintenanceEngine([{ assetId: 'P', runTag: 'R' }], deps);
    const wo = eng.createWorkOrder({ assetId: 'P', type: 'CM', reason: 'hỏng' }, 'u', 0);
    expect(wo.status).toBe('open');
    eng.updateWorkOrder(wo.woId, 'in-progress', 'u', H);
    const done = eng.updateWorkOrder(wo.woId, 'done', 'u', 5 * H);
    expect('status' in done && done.status).toBe('done');
    expect(eng.mttr('P')).toBeCloseTo(5, 5); // 5 h − 0
  });
});
