import { describe, it, expect } from 'vitest';
import type { AlarmDef, CauseEffectMatrix, IKnowledgeDoc } from '@idtp/sdk';
import { AiAdvisor } from '../src/ai-advisor';

const alarms: AlarmDef[] = [
  { alarmId: 'AL1', tagId: 'T1', condition: 'LL', priority: 'P1', setpoint: -250, deadband: 5, onDelayMs: 1, offDelayMs: 1, consequence: { vi: 'cạn nước lò', en: '' }, corrective: { vi: 'tăng cấp nước', en: '' } },
];
const matrices: CauseEffectMatrix[] = [
  { matrixId: 'mft', title: { vi: 'MFT', en: '' }, causes: [{ id: 'c1', tag: 'T1', op: 'lt', value: -250, title: { vi: '', en: '' } }], effects: [{ id: 'e1', tag: 'X', value: 1, title: { vi: 'trip nhiên liệu', en: '' } }], cells: [{ cause: 'c1', effect: 'e1' }] },
];
const knowledge: IKnowledgeDoc[] = [
  { docId: 'SOP-1', title: { vi: 'SOP mức thấp', en: '' }, kind: 'sop', text: '...', tagRefs: ['T1'] },
];

describe('AiAdvisor (doc 05-19) — rule-based, read-only, có trích dẫn', () => {
  it('giải thích alarm: hậu quả + nguyên nhân + khắc phục + leo thang + citations', () => {
    const adv = new AiAdvisor({ alarms, matrices, knowledge });
    const a = adv.explainAlarm('AL1', { value: -300, nowIso: '2026-07-24T10:00:00Z' });
    expect(a?.summary).toBe('cạn nước lò');
    expect(a?.recommended).toBe('tăng cấp nước');
    expect(a?.likelyCause).toContain('T1');
    expect(a?.likelyCause).toContain('-250');
    expect(a?.escalation).toContain('MFT');
    expect(a?.escalation).toContain('trip nhiên liệu');
    const kinds = (a?.citations ?? []).map((c) => c.kind);
    expect(kinds).toContain('alarm');
    expect(kinds).toContain('tag');
    expect(kinds).toContain('cause-effect');
    expect(kinds).toContain('sop');
    expect(a?.citations.some((c) => c.ref === 'SOP-1')).toBe(true);
  });

  it('alarm không tồn tại → undefined', () => {
    expect(new AiAdvisor({ alarms }).explainAlarm('NOPE')).toBeUndefined();
  });
});
