// L2 — Simulation Host (doc 05-05). Chạy các ISimModel của plugin; solver step tách publish;
// snapshot/restore + malfunction. Model vật lý nằm TRONG plugin.
import type { ISimModel, ISimModelContext, ISimSnapshot, IMalfunction, Iso8601, TagId, Quality } from '@idtp/sdk';

export interface SimOutput {
  tagId: TagId;
  value: number;
  quality: Quality;
}

export interface SimHostDeps {
  now(): Iso8601;
  getTag(tagId: TagId): number;
  onOutputs(outputs: ReadonlyArray<SimOutput>): void;
}

export class SimulationHost {
  private readonly models = new Map<string, ISimModel>();
  private frozen = false;

  constructor(
    private readonly dtMs: number,
    private readonly deps: SimHostDeps,
  ) {}

  register(model: ISimModel, config: unknown = {}): void {
    model.init(this.ctx(), config);
    this.models.set(model.id, model);
  }

  step(): void {
    if (this.frozen) return;
    const ctx = this.ctx();
    for (const m of this.models.values()) {
      const res = m.step(ctx);
      this.deps.onOutputs(res.outputs);
    }
  }

  freeze(on: boolean): void {
    this.frozen = on;
  }

  inject(modelId: string, m: IMalfunction): void {
    this.models.get(modelId)?.injectMalfunction(m);
  }

  clear(modelId: string, malfId: string): void {
    this.models.get(modelId)?.clearMalfunction(malfId);
  }

  snapshotAll(): Map<string, ISimSnapshot> {
    const out = new Map<string, ISimSnapshot>();
    for (const [id, m] of this.models) out.set(id, m.snapshot());
    return out;
  }

  restoreAll(snapshots: ReadonlyMap<string, ISimSnapshot>): void {
    for (const [id, snap] of snapshots) this.models.get(id)?.restore(snap);
  }

  private ctx(): ISimModelContext {
    return {
      dtMs: this.dtMs,
      getTag: (id: TagId): number => this.deps.getTag(id),
      now: (): Iso8601 => this.deps.now(),
    };
  }
}
