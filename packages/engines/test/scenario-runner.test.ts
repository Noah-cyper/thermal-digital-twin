import { describe, it, expect } from 'vitest';
import type { ScenarioDef } from '@idtp/sdk';
import { executeScenario, type ScenarioHost } from '../src/scenario-runner';

function fakeHost(): ScenarioHost & { steps: number; loads: number[]; injected: string[] } {
  const tags: Record<string, number> = { MW: 100 };
  const h = {
    steps: 0,
    loads: [] as number[],
    injected: [] as string[],
    step: () => {
      h.steps++;
      tags.MW = (tags.MW ?? 0) + 1; // mô phỏng đáp ứng
    },
    setLoad: (mw: number) => h.loads.push(mw),
    inject: (id: string) => h.injected.push(id),
    clear: () => {},
    set: (t: string, v: number) => {
      tags[t] = v;
    },
    runSequence: (id: string): 'done' | 'failed' => (id === 'bad' ? 'failed' : 'done'),
    getTag: (id: string) => tags[id] ?? 0,
  };
  return h;
}

describe('ScenarioRunner (doc 22) — generic qua ScenarioHost', () => {
  it('chạy các pha đúng thứ tự, settle đúng số bước, chụp sampleTags, SFC fail → pha fail', () => {
    const def: ScenarioDef = {
      scenarioId: 'X',
      title: { vi: '', en: '' },
      sampleTags: ['MW'],
      phases: [
        { phaseId: 'load', title: { vi: '', en: '' }, action: 'load', value: 550, settleSteps: 3 },
        { phaseId: 'trip', title: { vi: '', en: '' }, action: 'malfunction', ref: 'mill-trip', settleSteps: 2 },
        { phaseId: 'seq-ok', title: { vi: '', en: '' }, action: 'sequence', ref: 'good', settleSteps: 1 },
        { phaseId: 'seq-bad', title: { vi: '', en: '' }, action: 'sequence', ref: 'bad', settleSteps: 1 },
      ],
    };
    const host = fakeHost();
    const res = executeScenario(def, host);
    expect(res.map((r) => r.phaseId)).toEqual(['load', 'trip', 'seq-ok', 'seq-bad']);
    expect(host.loads).toEqual([550]);
    expect(host.injected).toEqual(['mill-trip']);
    expect(host.steps).toBe(3 + 2 + 1 + 1);
    expect(res[3]?.status).toBe('fail'); // SFC 'bad' → failed
    expect(res[0]?.status).toBe('ok');
    expect((res[0]?.tags['MW'] ?? 0)).toBe(103); // 100 + 3 bước
  });
});
