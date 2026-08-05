import { describe, it, expect } from 'vitest';
import * as E from '../src/index';

describe('@idtp/engines index — re-export toàn bộ engine L2', () => {
  it('mọi engine/giá trị runtime chính được re-export', () => {
    const names = [
      'SimulationHost', 'TagRealtimeEngine', 'ControlLoopEngine', 'AlarmEngine', 'MemoryHistorian',
      'TimescaleHistorian', 'KpiEngine', 'MaintenanceEngine', 'FaceplateEngine', 'NavigationEngine',
      'SequenceEngine', 'CauseEffectEngine', 'InterlockEngine', 'AiAdvisor', 'PredictiveMaintenance',
      'RegistrySimModel', 'ReportEngine', 'EventJournal', 'jsonCodec',
    ];
    for (const n of names) expect((E as Record<string, unknown>)[n], n).toBeDefined();
    expect(Object.keys(E).length).toBeGreaterThan(15);
  });
});
