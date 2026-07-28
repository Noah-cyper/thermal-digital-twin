import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — System Diagnostic (màn hình hệ thống, ISA-101 S-class)', () => {
  it('systemDiagnostics tự soi số liệu THẬT: sim/tag/loop/historian/alarm/journal', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.logEvent('system', 'info', 'diag test'); // đảm bảo journal có bản ghi

    const d = rt.systemDiagnostics();
    expect(d.sim.steps).toBeGreaterThan(0);
    expect(d.sim.frozen).toBe(false);
    expect(typeof d.sim.clock).toBe('string');

    expect(d.tags.recorded).toBeGreaterThan(0);
    expect(d.tags.good).toBeGreaterThan(0);
    expect(d.tags.good + d.tags.other).toBe(d.tags.recorded); // phân hoạch đầy đủ, không bịa
    expect(d.tags.catalog).toBeGreaterThan(3000); // §10 catalog (registry)

    expect(d.loops.total).toBeGreaterThan(0);
    expect(d.loops.auto + d.loops.man + d.loops.cascade).toBe(d.loops.total);
    expect(d.loops.auto).toBeGreaterThan(0); // sau warmup các loop CCS ở AUTO

    expect(d.historian.points).toBeGreaterThan(0);
    expect(d.historian.from).not.toBeNull();

    const bp = d.alarms.byPriority;
    const sum = (bp.P1 ?? 0) + (bp.P2 ?? 0) + (bp.P3 ?? 0) + (bp.P4 ?? 0);
    expect(d.alarms.active).toBe(sum);

    expect(d.journal.total).toBeGreaterThan(0);
    expect(d.journal.lastSeq).toBeGreaterThanOrEqual(d.journal.total);
  });

  it('phản ánh trạng thái freeze (OTS)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 20; i++) rt.step();
    rt.freeze(true);
    expect(rt.systemDiagnostics().sim.frozen).toBe(true);
    rt.freeze(false);
    expect(rt.systemDiagnostics().sim.frozen).toBe(false);
  });
});
