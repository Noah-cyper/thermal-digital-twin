// BÀI TEST GENERIC (doc 00 §5.4): plugin #2 chạy trên ĐÚNG các engine chung (@idtp/engines) mà
// plugin #1 dùng — SimulationHost · ControlLoopEngine · AlarmEngine · applyScreen — KHÔNG sửa một
// dòng nào trong packages/* & apps/*. Nếu test này xanh, luận điểm "mọi nhà máy chỉ là plugin" đứng.
import { describe, it, expect } from 'vitest';
import { SimulationHost, TagRealtimeEngine, ControlLoopEngine, AlarmEngine, applyScreen, type TagRead } from '@idtp/engines';
import { WaterTankModel, waterControlLoops, waterLoopSeeds, waterAlarms, waterScreens } from '../src/index';

const TS = '2026-07-24T10:00:00+07:00';

function build(demand = 100): {
  step: () => void;
  num: (id: string) => number;
  model: WaterTankModel;
  alarms: AlarmEngine;
} {
  const tag = new TagRealtimeEngine();
  const num = (id: string): number => {
    const v = tag.getCurrent(id);
    return typeof v?.value === 'number' ? v.value : 0;
  };
  const put = (id: string, value: number): void => tag.ingest([{ tagId: id, value, quality: 'Good', ts: TS }]);
  put('WTP_DEMAND_01', demand);
  put('WTP_FEED_CV_01', waterLoopSeeds['tank-level'] ?? 50);

  const host = new SimulationHost(100, {
    now: () => TS,
    getTag: num,
    onOutputs: (outs) => tag.ingest(outs.map((o) => ({ tagId: o.tagId, value: o.value, quality: o.quality, ts: TS }))),
  });
  const model = new WaterTankModel();
  host.register(model);
  const loops = new ControlLoopEngine(waterControlLoops);
  const alarms = new AlarmEngine(waterAlarms, { formatTs: (x) => `t${x}` });
  const alarmTags = ['WTP_TANK_LEVEL_01', 'WTP_FEED_FLOW_01', 'WTP_PUMP_A_RUN', 'WTP_DEMAND_01', 'WTP_OUT_FLOW_01'];
  let ms = 0;
  const step = (): void => {
    ms += 100;
    host.step();
    for (const o of loops.step({ getTag: num }, 0.1)) put(o.outTag, o.value);
    for (const t of alarmTags) alarms.evaluate(t, num(t), 'Good', ms);
  };
  return { step, num, model, alarms };
}

describe('GENERIC TEST — water-treatment-demo trên engine chung (0 dòng sửa packages/* & apps/*)', () => {
  it('SimulationHost + ControlLoopEngine generic: mức bể hội tụ về SP 60%', () => {
    const w = build(100);
    for (let i = 0; i < 6000; i++) w.step();
    expect(Math.abs(w.num('WTP_TANK_LEVEL_01') - 60)).toBeLessThan(8);
  });

  it('AlarmEngine generic: tank-leak → mức tụt → WTP-TANK-LVL-LO/LL nổi', () => {
    const w = build(100);
    for (let i = 0; i < 4000; i++) w.step();
    w.model.injectMalfunction({ id: 'tank-leak', params: { rate: 250 } });
    for (let i = 0; i < 8000; i++) w.step();
    const low = w.alarms.getActive().find((a) => a.alarmId === 'WTP-TANK-LVL-LO' || a.alarmId === 'WTP-TANK-LVL-LL');
    expect(low).toBeDefined();
  });

  it('Graphics binding generic: applyScreen render màn hình nước D1', () => {
    const d1 = waterScreens.find((s) => s.screenId === 'D1-wtp-overview');
    expect(d1).toBeDefined();
    if (!d1) return;
    const props = applyScreen(d1, new Map<string, TagRead>([['WTP_TANK_LEVEL_01', { value: 95, quality: 'Good' }]]));
    expect(props.get('level')?.text).toBe('95');
    expect(props.get('level')?.fill).toBe('var(--alarm-1)'); // > 90 → P1
  });

  it('bơm A trip → pump-a-trip alarm (DISCRETE/low trên WTP_PUMP_A_RUN)', () => {
    const w = build(100);
    for (let i = 0; i < 500; i++) w.step();
    w.model.injectMalfunction({ id: 'pump-a-trip' });
    for (let i = 0; i < 100; i++) w.step();
    expect(w.alarms.getActive().some((a) => a.alarmId === 'WTP-PUMP-A-TRIP')).toBe(true);
  });
});
