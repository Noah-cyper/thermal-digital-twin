import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Phủ nhánh runtime chưa test: updateWorkOrder (thành công + lỗi woId) và đếm mode loop
// trong systemDiagnostics (MAN/AUTO/CASCADE) — các nhánh không có đường WS trực tiếp.
describe('thermal-runtime — work order update & diagnostics mode counts (coverage)', () => {
  it('updateWorkOrder: tạo → cập nhật trạng thái hợp lệ (thành công) & woId sai (error)', () => {
    const rt = createThermalRuntime();
    const wo = rt.createWorkOrder('UNIT1', 'CM', 'coverage', 'maint');
    expect(wo.woId).toBeTruthy();

    const upd = rt.updateWorkOrder(wo.woId, 'in-progress', 'maint');
    expect('error' in upd).toBe(false);
    if (!('error' in upd)) expect(upd.status).toBe('in-progress');

    const bad = rt.updateWorkOrder('WO-KHONG-CO', 'done', 'maint');
    expect('error' in bad).toBe(true);
  });

  it('systemDiagnostics: đếm loop theo mode — có MAN & CASCADE sau khi đổi mode', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 20; i++) rt.step();

    // Đổi 2 loop sang MAN và CASCADE để chạm cả 2 nhánh đếm.
    rt.setLoopMode('drum-level', 'MAN');
    rt.setLoopMode('sh-temp', 'CASCADE');
    rt.step();

    const diag = rt.systemDiagnostics();
    expect(diag.loops.total).toBeGreaterThan(0);
    expect(diag.loops.man + diag.loops.auto + diag.loops.cascade).toBe(diag.loops.total);
    expect(diag.loops.man).toBeGreaterThanOrEqual(1);
    expect(diag.loops.cascade).toBeGreaterThanOrEqual(1);
  });
});
