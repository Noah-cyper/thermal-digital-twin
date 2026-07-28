import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Event Log / SOE (màn hình hệ thống, doc 15/18)', () => {
  it('tự ghi sự kiện từ vòng CCS: lệnh · hệ thống · bảo mật · trip (loss-of-vacuum → turbine trip chốt)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 50; i++) rt.step();

    rt.setLoadDemand(500); // → command
    rt.logEvent('security', 'info', 'đăng nhập thử', 'op'); // → security (server đẩy cho login)
    rt.injectMalfunction({ id: 'loss-of-vacuum', params: { kpa: 30 } }); // → system, sau đó turbine trip
    for (let i = 0; i < 2000; i++) rt.step();

    const cats = new Set(rt.eventLog({ limit: 1000 }).map((e) => e.category));
    expect(cats.has('command')).toBe(true);
    expect(cats.has('system')).toBe(true);
    expect(cats.has('security')).toBe(true);
    expect(cats.has('trip')).toBe(true); // C&E turbine-trip chốt (tất định, GĐ-47)

    // lệnh đặt tải ghi đúng nội dung + nguồn tag
    const loadCmd = rt.eventLog({ category: 'command' }).find((e) => e.message.includes('BLR_MW_DEMAND'));
    expect(loadCmd).toBeDefined();
    expect(loadCmd?.source).toBe('BLR_MW_DEMAND');

    // sự kiện bảo mật giữ actor
    expect(rt.eventLog({ category: 'security' })[0]?.actor).toBe('op');

    // summary nhất quán với nhật ký
    const sum = rt.eventSummary();
    expect(sum.total).toBeGreaterThan(0);
    expect(sum.byCategory.command).toBeGreaterThanOrEqual(1);
    expect(sum.byCategory.trip).toBeGreaterThanOrEqual(1);
    expect(sum.notable.length).toBeGreaterThan(0); // có sự kiện đáng chú ý (trip)
  });
});
