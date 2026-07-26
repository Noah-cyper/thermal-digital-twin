import { describe, it, expect } from 'vitest';
import type { AlarmDef } from '@idtp/sdk';
import { AlarmEngine } from '../src/alarm-engine';

const deps = { formatTs: (ms: number): string => `t${ms}` };
function hh(over: Partial<AlarmDef> = {}): AlarmDef {
  return {
    alarmId: 'A',
    tagId: 'T',
    condition: 'HH',
    priority: 'P1',
    setpoint: 250,
    deadband: 5,
    onDelayMs: 2000,
    offDelayMs: 8000,
    consequence: { vi: '', en: '' },
    ...over,
  };
}
function stateOf(eng: AlarmEngine): string {
  return eng.getActive()[0]?.state ?? 'Normal';
}

describe('AlarmEngine (ISA-18.2)', () => {
  it('on-delay: cond true nhưng chưa đủ onDelay → chưa alarm; đủ → UnackAlarm', () => {
    const eng = new AlarmEngine([hh()], deps);
    eng.evaluate('T', 300, 'Good', 0);
    eng.evaluate('T', 300, 'Good', 1000);
    expect(eng.getActive()).toHaveLength(0); // 1000 < onDelay 2000
    eng.evaluate('T', 300, 'Good', 2000);
    expect(stateOf(eng)).toBe('UnackAlarm');
  });

  it('vòng đời đầy đủ: UnackAlarm → ack → AckAlarm → (off-delay) → Normal', () => {
    const eng = new AlarmEngine([hh()], deps);
    const seq: string[] = [];
    eng.onTransition((e) => seq.push(e.state));
    eng.evaluate('T', 300, 'Good', 0);
    eng.evaluate('T', 300, 'Good', 2000); // UnackAlarm
    eng.ack('A', 'op', 2500); // AckAlarm
    expect(stateOf(eng)).toBe('AckAlarm');
    eng.evaluate('T', 100, 'Good', 3000); // cond false từ 3000
    eng.evaluate('T', 100, 'Good', 11000); // off-delay 8000 đủ → Normal (đã ack)
    expect(eng.getActive()).toHaveLength(0);
    expect(seq).toEqual(['UnackAlarm', 'AckAlarm', 'Normal']);
  });

  it('RtnUnack: cond hết trước khi ack → RtnUnack; ack → Normal', () => {
    const eng = new AlarmEngine([hh()], deps);
    eng.evaluate('T', 300, 'Good', 0);
    eng.evaluate('T', 300, 'Good', 2000); // UnackAlarm
    eng.evaluate('T', 100, 'Good', 3000); // cond false
    eng.evaluate('T', 100, 'Good', 11000); // off-delay → RtnUnack
    expect(stateOf(eng)).toBe('RtnUnack');
    eng.ack('A', 'op', 12000);
    expect(eng.getActive()).toHaveLength(0);
  });

  it('deadband hysteresis: giữ alarm tới khi dưới sp−db mới nhả', () => {
    const eng = new AlarmEngine([hh()], deps);
    eng.evaluate('T', 300, 'Good', 0);
    eng.evaluate('T', 300, 'Good', 2000); // active
    eng.evaluate('T', 248, 'Good', 3000); // 248 ≥ 245 → vẫn active
    eng.evaluate('T', 248, 'Good', 12000);
    expect(stateOf(eng)).toBe('UnackAlarm');
    eng.evaluate('T', 240, 'Good', 13000); // < 245 → cond false
    eng.evaluate('T', 240, 'Good', 22000); // off-delay → nhả (chưa ack → RtnUnack, đúng ISA-18.2)
    expect(stateOf(eng)).toBe('RtnUnack');
  });

  it('shelve: > 8 h bị chặn; ≤ 8 h → Shelved và tự bung khi hết hạn', () => {
    const eng = new AlarmEngine([hh()], deps);
    expect(eng.shelve('A', 'op', 600, 'x', 0)).toEqual({ blockedReason: expect.stringContaining('480') });
    const ev = eng.shelve('A', 'op', 60, 'bảo trì', 1000);
    expect('state' in ev && ev.state).toBe('Shelved');
    eng.evaluate('T', 300, 'Good', 2000); // đang shelved → không alarm
    expect(eng.getActive()).toHaveLength(0);
    const expiry = 1000 + 60 * 60_000;
    eng.evaluate('T', 300, 'Good', expiry + 100); // quá hạn → tự bung về Normal, bắt đầu lại on-delay
    eng.evaluate('T', 300, 'Good', expiry + 2200); // đủ on-delay → UnackAlarm
    expect(stateOf(eng)).toBe('UnackAlarm');
  });

  it('suppression theo trạng thái thiết bị: không alarm khi suppressWhen đúng', () => {
    let shutdown = true;
    const eng = new AlarmEngine([hh({ suppressWhen: 'unit_state == SHUTDOWN' })], deps);
    eng.setSuppressionEvaluator(() => shutdown);
    eng.evaluate('T', 300, 'Good', 0);
    eng.evaluate('T', 300, 'Good', 2000);
    expect(eng.getActive()).toHaveLength(0); // bị suppress
    shutdown = false;
    eng.evaluate('T', 300, 'Good', 3000);
    eng.evaluate('T', 300, 'Good', 5000); // onDelay sau khi bỏ suppress
    expect(stateOf(eng)).toBe('UnackAlarm');
  });

  it('bad quality → không phát process alarm; OOS chặn alarm', () => {
    const eng = new AlarmEngine([hh()], deps);
    eng.evaluate('T', 300, 'Bad', 0);
    eng.evaluate('T', 300, 'Bad', 3000);
    expect(eng.getActive()).toHaveLength(0);
    eng.outOfService('A', 'maint', true, 3500);
    eng.evaluate('T', 300, 'Good', 4000);
    eng.evaluate('T', 300, 'Good', 7000);
    expect(eng.getActive()).toHaveLength(0); // OOS
  });

  it('KPI: đếm rate, bad-actor, phân bố priority', () => {
    const eng = new AlarmEngine([hh(), hh({ alarmId: 'B', priority: 'P3', setpoint: 260 })], deps);
    eng.evaluate('T', 300, 'Good', 0);
    eng.evaluate('T', 300, 'Good', 2000); // A + B đều active
    const k = eng.kpi(2000);
    expect(k.active).toBe(2);
    expect(k.byPriority.P1).toBe(1);
    expect(k.byPriority.P3).toBe(1);
    expect(k.ratePer10Min).toBe(2);
    expect(k.badActors[0]?.count).toBeGreaterThanOrEqual(1);
  });
});
