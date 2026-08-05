import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// doc 08 §5.1 — "6+1" điều kiện BoP nay là AlarmDef first-class: tiêm malfunction → alarm tương ứng nổi.
const CASES: Array<{ malf: string; alarmId: string }> = [
  { malf: 'dm-resin-fault', alarmId: 'WTP-DM-COND-HI' },
  { malf: 'station-blackout', alarmId: 'EMG-STATION-BLACKOUT' },
  { malf: 'line-trip', alarmId: 'SWY-LINE-TRIP' },
  { malf: 'hvac-chiller-trip', alarmId: 'HVAC-CR-TEMP-HI' },
  { malf: 'fire-detected', alarmId: 'FIRE-DETECTED' },
  { malf: 'chem-dosing-fail', alarmId: 'CHEM-FW-PH-LO' },
  { malf: 'instrument-air-loss', alarmId: 'CA-IA-PRESS-LO' },
];
const ALL_IDS = CASES.map((c) => c.alarmId);

describe('thermal-runtime — rationalize 6+1 điều kiện BoP thành AlarmDef first-class (doc 08 §5.1)', () => {
  it('vận hành ổn định → KHÔNG alarm BoP nào trong 7 nổi (deadband/delay đúng, 0 phiền nhiễu)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();
    const active = new Set(rt.activeAlarms().map((a) => a.alarmId));
    for (const id of ALL_IDS) expect(active.has(id)).toBe(false);
  });

  for (const { malf, alarmId } of CASES) {
    it(`tiêm '${malf}' → alarm '${alarmId}' nổi (qua on-delay + transient)`, () => {
      const rt = createThermalRuntime();
      for (let i = 0; i < 300; i++) rt.step();
      expect(rt.activeAlarms().some((a) => a.alarmId === alarmId)).toBe(false); // chưa nổi khi bình thường
      rt.injectMalfunction({ id: malf });
      let fired = false;
      for (let i = 0; i < 2000 && !fired; i++) {
        rt.step();
        fired = rt.activeAlarms().some((a) => a.alarmId === alarmId);
      }
      expect(fired).toBe(true);
    });
  }

  it('gỡ malfunction → điều kiện phục hồi; ACK + RTN → alarm rời danh sách active (ISA-18.2)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    rt.injectMalfunction({ id: 'fire-detected' });
    let fired = false;
    for (let i = 0; i < 500 && !fired; i++) { rt.step(); fired = rt.activeAlarms().some((a) => a.alarmId === 'FIRE-DETECTED'); }
    expect(fired).toBe(true);

    // Gỡ malfunction → điều kiện (tag báo cháy) phục hồi bình thường.
    rt.clearMalfunction('fire-detected');
    for (let i = 0; i < 100; i++) rt.step();
    expect(rt.value('FIRE_ALARM_ACTIVE_01')).toBeLessThan(0.5);

    // ISA-18.2: alarm chỉ rời active khi ĐÃ ACK + đã RTN. ACK rồi chờ off-delay.
    rt.ackAlarm('FIRE-DETECTED', 'op');
    let cleared = false;
    for (let i = 0; i < 500 && !cleared; i++) { rt.step(); cleared = !rt.activeAlarms().some((a) => a.alarmId === 'FIRE-DETECTED'); }
    expect(cleared).toBe(true);
  });
});
