import { describe, it, expect } from 'vitest';
import type { IWriteCommand, SequenceDef } from '@idtp/sdk';
import { SequenceEngine } from '@idtp/engines';
import { thermalSequences } from '../src/sequences/defs';

function run(def: SequenceDef, tags: Record<string, number> = {}): string {
  const clock = { t: 0 };
  const io = {
    getTag: (id: string) => tags[id] ?? 0,
    command: (c: IWriteCommand) => { tags[c.tagId] = typeof c.value === 'number' ? c.value : c.value ? 1 : 0; },
    now: () => clock.t,
  };
  const eng = new SequenceEngine(def, io);
  eng.start();
  for (let i = 0; i < 5000 && eng.state().status === 'running'; i++) { clock.t += 100; eng.tick(); }
  return eng.state().status;
}
const find = (id: string): SequenceDef => {
  const d = thermalSequences.find((s) => s.sequenceId === id);
  if (!d) throw new Error('không có SFC ' + id);
  return d;
};

describe('thermal SFC — tiền đề cold-start (chân không + nâng áp)', () => {
  it('≥ 11 chuỗi SFC (thêm condenser-vacuum-raise + pressure-raising)', () => {
    expect(thermalSequences.length).toBeGreaterThanOrEqual(11);
  });

  it('condenser-vacuum-raise chạy tới done (gland → SJAE → chân không đạt)', () => {
    // chân không mặc định 0 kPa(a) ≤ ngưỡng 10 → transition kéo-chân-không đạt; permissive gland do bước
    // gland-steam tự đặt trong chuỗi.
    expect(run(find('condenser-vacuum-raise'), {})).toBe('done');
  });

  it('pressure-raising: bị chặn khi chưa có lửa; chạy done khi đã light-off + áp đạt', () => {
    // permissive sh-drains-open cần BLR_FIRST_FUEL_CMD ≥ 1; transition raise cần áp ≥ 16 MPa.
    expect(run(find('pressure-raising'), {})).toBe('failed');
    expect(run(find('pressure-raising'), { BLR_FIRST_FUEL_CMD: 1, BLR_MSTM_SH_PRESS_01: 17.5 })).toBe('done');
  });

  it('mọi action của 2 SFC mới có reason (audit)', () => {
    for (const id of ['condenser-vacuum-raise', 'pressure-raising']) {
      for (const st of find(id).steps) for (const a of st.actions) expect(a.reason.length).toBeGreaterThan(0);
    }
  });
});
