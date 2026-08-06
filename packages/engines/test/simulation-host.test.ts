// Test TRỰC TIẾP SimulationHost (doc 05-05) — orchestrator ISimModel chỉ được phủ gián tiếp qua app/plugin.
// Phủ đầy: register+init · step publish · freeze · inject/clear (đích + injectAll/clearAll) · snapshot/restore ·
// bỏ qua modelId không tồn tại. Dùng model GIẢ đếm gọi (tất định, không Math.random).
import { describe, it, expect } from 'vitest';
import { SimulationHost } from '../src/simulation-host';
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

class FakeModel implements ISimModel {
  readonly id: string;
  readonly tagsProvided: ReadonlyArray<TagId>;
  initCalls = 0;
  stepCalls = 0;
  malf: string | null = null;
  cleared: string | null = null;
  private bias = 0;
  constructor(id: string, private readonly outTag: TagId) {
    this.id = id;
    this.tagsProvided = [outTag];
  }
  init(_ctx?: ISimModelContext, _config?: unknown): void { this.initCalls += 1; }
  step(ctx: ISimModelContext): ISimStepResult {
    this.stepCalls += 1;
    // đọc dt + tag qua ctx (phủ nhánh ctx.getTag/dtMs) và cộng bias (đổi bởi malfunction/restore).
    const base = ctx.getTag('SEED_IN') + ctx.dtMs / 1000;
    return { outputs: [{ tagId: this.outTag, value: base + this.bias, quality: 'Good' }] };
  }
  snapshot(): ISimSnapshot { return { state: { bias: this.bias } }; }
  restore(s: ISimSnapshot): void { this.bias = s.state.bias ?? 0; }
  injectMalfunction(m: IMalfunction): void { this.malf = m.id; if (m.id === 'boost') this.bias = 100; }
  clearMalfunction(id: string): void { this.cleared = id; if (id === 'boost') this.bias = 0; }
  dispose(): void {}
}

function harness(): { host: SimulationHost; tags: Map<string, number>; now: string } {
  const tags = new Map<string, number>([['SEED_IN', 10]]);
  const now = '2026-07-24T10:00:00+07:00';
  const host = new SimulationHost(200, {
    now: () => now,
    getTag: (id) => tags.get(id) ?? 0,
    onOutputs: (outs) => { for (const o of outs) tags.set(o.tagId, o.value); },
  });
  return { host, tags, now };
}

describe('SimulationHost (doc 05-05) — orchestrator ISimModel', () => {
  it('register gọi init; step publish outputs (đọc dt + tag qua ctx)', () => {
    const { host, tags } = harness();
    const m = new FakeModel('m1', 'OUT_1');
    host.register(m);
    expect(m.initCalls).toBe(1);
    host.step();
    expect(m.stepCalls).toBe(1);
    expect(tags.get('OUT_1')).toBe(10 + 0.2); // SEED_IN 10 + dt 200 ms = 0,2 s
  });

  it('freeze: step KHÔNG chạy model khi đóng băng; mở lại thì chạy', () => {
    const { host } = harness();
    const m = new FakeModel('m1', 'OUT_1');
    host.register(m);
    host.freeze(true);
    host.step();
    expect(m.stepCalls).toBe(0);
    host.freeze(false);
    host.step();
    expect(m.stepCalls).toBe(1);
  });

  it('inject/clear theo modelId đích + bỏ qua modelId không tồn tại (an toàn)', () => {
    const { host, tags } = harness();
    const m = new FakeModel('m1', 'OUT_1');
    host.register(m);
    host.inject('m1', { id: 'boost' });
    expect(m.malf).toBe('boost');
    host.step();
    expect(tags.get('OUT_1')).toBeCloseTo(10 + 0.2 + 100, 6); // bias +100
    host.clear('m1', 'boost');
    expect(m.cleared).toBe('boost');
    // modelId lạ → no-op, không ném
    expect(() => host.inject('khong-co', { id: 'x' })).not.toThrow();
    expect(() => host.clear('khong-co', 'x')).not.toThrow();
  });

  it('injectAll/clearAll: mọi model nhận (tự lọc theo id)', () => {
    const { host } = harness();
    const a = new FakeModel('a', 'OUT_A');
    const b = new FakeModel('b', 'OUT_B');
    host.register(a);
    host.register(b);
    host.injectAll({ id: 'boost' });
    expect(a.malf).toBe('boost');
    expect(b.malf).toBe('boost');
    host.clearAll('boost');
    expect(a.cleared).toBe('boost');
    expect(b.cleared).toBe('boost');
  });

  it('snapshotAll/restoreAll: round-trip trạng thái model; restore bỏ qua id thiếu', () => {
    const { host } = harness();
    const m = new FakeModel('m1', 'OUT_1');
    host.register(m);
    host.inject('m1', { id: 'boost' }); // bias 100
    const snap = host.snapshotAll();
    expect(snap.get('m1')?.state.bias).toBe(100);

    host.clear('m1', 'boost'); // bias 0
    host.restoreAll(snap); // khôi phục bias 100
    host.step();
    expect(m.snapshot().state.bias).toBe(100);

    // restore với id không có trong host → bỏ qua, không ném
    const extra = new Map(snap);
    extra.set('ghost', { state: { bias: 5 } });
    expect(() => host.restoreAll(extra)).not.toThrow();
  });
});
