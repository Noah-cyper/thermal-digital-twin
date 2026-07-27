// @idtp/engines — ScenarioRunner (doc 22). Diễn ScenarioDef KHAI BÁO: mỗi pha thực thi hành động
// (chạy SFC · đặt tải · tiêm/xoá malfunction · set tag · settle) rồi chạy sim settleSteps, chụp tag.
// GENERIC qua ScenarioHost (runtime cấp adapter). Ráp SFC + malfunction + CCS thành kịch bản §10.
import type { ScenarioDef, ScenarioPhaseResult, SeqRunStatus } from '@idtp/sdk';

export interface ScenarioHost {
  step(): void;
  setLoad(mw: number): void;
  inject(id: string): void;
  clear(id: string): void;
  set(tagId: string, value: number): void;
  runSequence(id: string): SeqRunStatus;
  getTag(id: string): number;
}

export function executeScenario(def: ScenarioDef, host: ScenarioHost): ScenarioPhaseResult[] {
  const out: ScenarioPhaseResult[] = [];
  for (const p of def.phases) {
    let status: 'ok' | 'fail' = 'ok';
    let note = '';
    switch (p.action) {
      case 'sequence': {
        if (!p.ref) {
          status = 'fail';
          note = 'thiếu sequenceId';
        } else {
          const s = host.runSequence(p.ref);
          if (s !== 'done') {
            status = 'fail';
            note = `SFC ${p.ref} → ${s}`;
          }
        }
        break;
      }
      case 'load':
        host.setLoad(p.value ?? 0);
        break;
      case 'malfunction':
        if (p.ref) host.inject(p.ref);
        break;
      case 'clear':
        if (p.ref) host.clear(p.ref);
        break;
      case 'set':
        if (p.ref) host.set(p.ref, p.value ?? 0);
        break;
      case 'settle':
        break;
    }
    for (let i = 0; i < p.settleSteps; i++) host.step();
    const tags: Record<string, number> = {};
    for (const t of def.sampleTags) tags[t] = host.getTag(t);
    out.push({ phaseId: p.phaseId, status, note, tags });
  }
  return out;
}
