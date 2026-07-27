import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Maintenance (giờ chạy + work order)', () => {
  it('tích giờ chạy UNIT1/MILL/BFP khi vận hành; tạo work order', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    const runtime = rt.maintenanceRuntime();
    const unit = runtime.find((r) => r.assetId === 'UNIT1');
    expect(unit).toBeDefined();
    if (!unit) return;
    expect(unit.running).toBe(true);
    expect(unit.runningHours).toBeGreaterThan(0);
    expect(unit.startCount).toBeGreaterThanOrEqual(1);

    const wo = rt.createWorkOrder('UNIT1', 'CM', 'kiểm tra', 'engineer');
    expect(wo.status).toBe('open');
    expect(rt.workOrders().length).toBeGreaterThan(0);
  });
});
