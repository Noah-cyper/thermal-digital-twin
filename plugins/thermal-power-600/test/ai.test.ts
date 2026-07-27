import { describe, it, expect } from 'vitest';
import { AiAdvisor } from '@idtp/engines';
import { thermalKnowledge, thermalKnowledgeSource } from '../src/ai/knowledge';
import { boilerAlarms } from '../src/alarms/boiler-alarms';
import { thermalCauseEffect } from '../src/cause-effect/matrices';

describe('thermal AI knowledge + advisor (doc 20)', () => {
  it('tri thức hợp lệ: mỗi doc có tagRefs; source.list() trả đủ', async () => {
    for (const d of thermalKnowledge) {
      expect(d.tagRefs.length).toBeGreaterThan(0);
      expect(['sop', 'cause-effect', 'narrative']).toContain(d.kind);
      expect(d.text.length).toBeGreaterThan(10);
    }
    expect((await thermalKnowledgeSource.list()).length).toBe(thermalKnowledge.length);
  });

  it('giải thích alarm bao hơi → leo thang MFT + trích dẫn nguồn có drum tag', () => {
    const adv = new AiAdvisor({ alarms: boilerAlarms, matrices: thermalCauseEffect, knowledge: thermalKnowledge });
    const a = adv.explainAlarm('BLR-DRUM-LVL-HH', { value: 300 });
    expect(a).toBeDefined();
    expect(a?.escalation).toContain('Master Fuel Trip'); // mức bao hơi là nguyên nhân của ma trận MFT
    expect(a?.citations.some((c) => c.ref === 'CE-MFT')).toBe(true); // doc tri thức có tagRef bao hơi
  });
});
