import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Report ca/ngày (doc 21)', () => {
  it('generateReport tổng hợp từ Historian: 4 mục (gồm sức khoẻ AI), bảng vận hành có dữ liệu', async () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step(); // tích luỹ lịch sử
    const r = await rt.generateReport(8);
    expect(r.sections.length).toBe(4);
    // mục sức khoẻ AI có mặt + bảng chỉ số
    const health = r.sections.find((s) => /Sức khoẻ tài sản/.test(s.title.vi));
    expect(health).toBeDefined();
    expect(health?.blocks.some((b) => b.kind === 'table')).toBe(true);
    const table = r.sections[0]?.blocks[0];
    expect(table?.kind).toBe('table');
    if (table?.kind === 'table') {
      expect(table.rows.length).toBeGreaterThanOrEqual(5);
      // MW trung bình > 0 (đang phát)
      const mwRow = table.rows.find((row) => row[0]?.includes('MW'));
      expect(Number(mwRow?.[1] ?? 0)).toBeGreaterThan(0);
    }
  });
});
