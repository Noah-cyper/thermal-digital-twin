import { describe, it, expect } from 'vitest';
import type { FaceplateDef } from '@idtp/sdk';
import { FaceplateEngine, type FaceplateResolvers } from '../src/faceplate-engine';

const def: FaceplateDef = {
  faceplateId: 'fp',
  assetId: 'A',
  title: { vi: 'X', en: 'X' },
  loopId: 'L',
  pvTag: 'PV',
  sp: 0,
  opTag: 'OP',
  eu: 'mm',
  rangeLo: -100,
  rangeHi: 100,
  kks: 'K1',
  alarmIds: ['AL1'],
  trendTags: ['PV'],
};

const resolvers: FaceplateResolvers = {
  read: (t) => (t === 'PV' ? { value: 42, quality: 'Good' } : t === 'OP' ? { value: 60, quality: 'Good' } : undefined),
  loopMode: () => 'AUTO',
  loopOutput: () => 60,
  alarmDef: (id) => (id === 'AL1' ? { priority: 'P1', condition: 'HH', setpoint: 80 } : undefined),
  activeAlarmIds: () => new Set(['AL1']),
  runtime: () => ({ runningHours: 5, startCount: 2 }),
  blockedReason: () => null,
};

describe('FaceplateEngine (doc 05-15)', () => {
  it('open + overview (PV/SP/OP/mode)', () => {
    const eng = new FaceplateEngine([def]);
    expect(eng.open('A')?.faceplateId).toBe('fp');
    const o = eng.overview(def, resolvers);
    expect(o.pv).toBe(42);
    expect(o.sp).toBe(0);
    expect(o.op).toBe(60);
    expect(o.mode).toBe('AUTO');
  });

  it('tab Alarm: limit + trạng thái active', () => {
    const rows = new FaceplateEngine([def]).alarms(def, resolvers);
    expect(rows[0]?.setpoint).toBe(80);
    expect(rows[0]?.priority).toBe('P1');
    expect(rows[0]?.active).toBe(true);
  });

  it('tab Detail: kks/eu/range + giờ chạy + blocked null', () => {
    const d = new FaceplateEngine([def]).detail(def, resolvers);
    expect(d.kks).toBe('K1');
    expect(d.runningHours).toBe(5);
    expect(d.startCount).toBe(2);
    expect(d.blockedReason).toBeNull();
  });
});
