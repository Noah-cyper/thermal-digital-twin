import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — RE-SIMULATION what-if (doc 05-05, nhánh độc lập từ snapshot)', () => {
  it('nhánh "mất chân không" cho MW thấp hơn nhánh cơ sở; sim LIVE không bị đụng', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 20; i++) rt.step();
    const liveMw = rt.value('GEN_MW_01');

    const base = rt.reSimulate({ steps: 400, sampleTags: ['GEN_MW_01'], everyN: 100 });
    const mal = rt.reSimulate({ malfunction: 'loss-of-vacuum', steps: 400, sampleTags: ['GEN_MW_01'], everyN: 100 });

    expect(base.trajectory.length).toBe(4);
    const baseEnd = base.trajectory.at(-1)?.tags['GEN_MW_01'] ?? 0;
    const malEnd = mal.trajectory.at(-1)?.tags['GEN_MW_01'] ?? 0;
    expect(malEnd).toBeLessThan(baseEnd - 30); // what-if: mất chân không → MW nhánh tụt

    expect(rt.value('GEN_MW_01')).toBe(liveMw); // re-sim KHÔNG bước/đổi sim live
  });
});
