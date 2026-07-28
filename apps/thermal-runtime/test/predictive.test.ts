import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — Predictive maintenance (rule-based, read-only)', () => {
  it('ổn định: không cảnh báo chân không; mất chân không → cảnh báo dự đoán', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 10; i++) rt.step();
    expect(rt.evaluatePredictive().some((a) => a.ruleId.startsWith('PRD-VAC'))).toBe(false);

    rt.injectMalfunction({ id: 'loss-of-vacuum' });
    for (let i = 0; i < 400; i++) rt.step();
    const adv = rt.evaluatePredictive();
    expect(adv.some((a) => a.ruleId === 'PRD-VAC-THR')).toBe(true); // chân không xấu → cảnh báo
    expect(rt.predictiveAdvisories()).toBe(adv); // lưu kết quả gần nhất
  });
});
