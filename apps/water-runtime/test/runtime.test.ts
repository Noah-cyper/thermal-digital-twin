import { describe, it, expect } from 'vitest';
import { createWaterRuntime, WATER_TAGS } from '../src/runtime';

// App plugin #2 chạy trên engine chung: bể hội tụ, RO sống, sự cố → alarm. Chứng minh digital twin thứ 2.
describe('water-runtime — app plugin #2 (Tank + RO trên kernel chung)', () => {
  it('điểm vận hành: mức bể ~SP, RO thu hồi ~75% & khử muối ~99%, mọi tag hữu hạn', () => {
    const rt = createWaterRuntime();
    for (let i = 0; i < 100; i++) rt.step();
    expect(Math.abs(rt.value('WTP_TANK_LEVEL_01') - 60)).toBeLessThan(12); // hội tụ SP 60%
    expect(rt.value('WTP_RO_RECOVERY_01')).toBeGreaterThan(70);
    expect(rt.value('WTP_RO_SALT_REJECT_01')).toBeGreaterThan(99);
    expect(rt.value('WTP_RO_HEALTHY_01')).toBe(1);
    for (const t of WATER_TAGS) expect(Number.isFinite(rt.value(t)), `tag ${t}`).toBe(true);
  });

  it('membrane-breach: độ dẫn permeate vọt → alarm WTP-RO-COND-HI', () => {
    const rt = createWaterRuntime();
    for (let i = 0; i < 50; i++) rt.step();
    rt.injectMalfunction({ id: 'membrane-breach' });
    for (let i = 0; i < 60; i++) rt.step();
    expect(rt.value('WTP_RO_PERM_COND_01')).toBeGreaterThan(15);
    expect(rt.activeAlarms().some((a) => a.alarmId === 'WTP-RO-COND-HI')).toBe(true);
  });

  it('tank-leak: mức bể tụt → alarm mức thấp', () => {
    const rt = createWaterRuntime();
    for (let i = 0; i < 50; i++) rt.step();
    rt.injectMalfunction({ id: 'tank-leak', params: { rate: 250 } });
    for (let i = 0; i < 7000; i++) rt.step(); // mức tụt chậm (bơm không bù nổi rò) → xuống ngưỡng LO
    expect(rt.activeAlarms().some((a) => a.alarmId === 'WTP-TANK-LVL-LO' || a.alarmId === 'WTP-TANK-LVL-LL')).toBe(true);
  });

  it('screens() trả màn hình nước (gồm D3-wtp-ro)', () => {
    const rt = createWaterRuntime();
    const ids = rt.screens().map((s) => s.screenId);
    expect(ids).toContain('D1-wtp-overview');
    expect(ids).toContain('D3-wtp-ro');
  });
});
