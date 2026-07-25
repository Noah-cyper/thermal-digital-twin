import { describe, it, expect } from 'vitest';
import { PidController } from '../src/control';

describe('PidController', () => {
  it('MAN giữ manual output', () => {
    const pid = new PidController({ kp: 1, ki: 0, kd: 0, outLo: 0, outHi: 100 });
    pid.setManualOutput(42);
    expect(pid.step(10, 0, 0.1)).toBe(42);
  });

  it('AUTO khử offset: integral kéo PV về SP', () => {
    // plant tĩnh gain 1 (pv = out): PI phải tích luỹ integral tới khi err → 0.
    const pid = new PidController({ kp: 0.5, ki: 0.5, kd: 0, outLo: 0, outHi: 100 });
    pid.setMode('AUTO');
    let pv = 0;
    for (let i = 0; i < 400; i++) pv = pid.step(pv, 10, 0.1);
    expect(Math.abs(pv - 10)).toBeLessThan(1);
  });

  it('anti-windup: output kẹp trong [outLo, outHi]', () => {
    const pid = new PidController({ kp: 10, ki: 5, kd: 0, outLo: 0, outHi: 100 });
    pid.setMode('AUTO');
    let out = 0;
    for (let i = 0; i < 50; i++) out = pid.step(0, 1000, 0.1); // SP xa → bão hoà
    expect(out).toBeLessThanOrEqual(100);
    expect(out).toBeGreaterThanOrEqual(0);
  });

  it('bumpless: MAN→AUTO giữ output liên tục', () => {
    const pid = new PidController({ kp: 1, ki: 0.1, kd: 0, outLo: 0, outHi: 100 });
    pid.setManualOutput(60);
    pid.step(5, 5, 0.1);
    pid.setMode('AUTO');
    const firstAuto = pid.step(5, 5, 0.1); // err=0 → giữ ~60 nhờ tracking integral
    expect(Math.abs(firstAuto - 60)).toBeLessThan(2);
  });
});
