// L2 — Tag/Realtime Engine (doc 05-01). Report-by-exception theo deadband, subscribe theo màn hình,
// alias hoá payload, quality code.
import type { TagId, TagValue, Quality, Iso8601 } from '@idtp/sdk';

export type SubscriptionHandle = string;

export interface TagDelta {
  alias: number;
  value: number | boolean | string;
  quality: Quality;
  ts: Iso8601;
}

export type DeltaCallback = (sessionId: string, deltas: ReadonlyArray<TagDelta>) => void;

interface Subscription {
  sessionId: string;
  screenId: string;
  tagIds: Set<TagId>;
}

export class TagRealtimeEngine {
  private readonly current = new Map<TagId, TagValue>();
  private readonly lastPub = new Map<TagId, { value: TagValue['value']; quality: Quality }>();
  private readonly deadband = new Map<TagId, number>();
  private readonly aliasOf = new Map<TagId, number>();
  private readonly subs = new Map<SubscriptionHandle, Subscription>();
  private readonly subsByTag = new Map<TagId, Set<SubscriptionHandle>>();
  private readonly callbacks = new Set<DeltaCallback>();
  private aliasSeq = 0;
  private handleSeq = 0;

  setDeadband(tagId: TagId, deadband: number): void {
    this.deadband.set(tagId, deadband);
  }

  onDelta(cb: DeltaCallback): () => void {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  getCurrent(tagId: TagId): TagValue | undefined {
    return this.current.get(tagId);
  }

  ingest(values: ReadonlyArray<TagValue>): void {
    const changed: TagId[] = [];
    for (const v of values) {
      this.current.set(v.tagId, v);
      if (this.shouldPublish(v)) {
        this.lastPub.set(v.tagId, { value: v.value, quality: v.quality });
        changed.push(v.tagId);
      }
    }
    if (changed.length === 0) return;

    const perSession = new Map<string, TagDelta[]>();
    for (const tagId of changed) {
      const v = this.current.get(tagId);
      if (!v) continue;
      const handles = this.subsByTag.get(tagId);
      if (!handles) continue;
      const delta: TagDelta = { alias: this.aliasFor(tagId), value: v.value, quality: v.quality, ts: v.ts };
      for (const h of handles) {
        const sub = this.subs.get(h);
        if (!sub) continue;
        const arr = perSession.get(sub.sessionId) ?? [];
        arr.push(delta);
        perSession.set(sub.sessionId, arr);
      }
    }
    this.emit(perSession);
  }

  subscribeScreen(sessionId: string, screenId: string, tagIds: ReadonlyArray<TagId>): SubscriptionHandle {
    const handle = `sub-${++this.handleSeq}`;
    const set = new Set(tagIds);
    this.subs.set(handle, { sessionId, screenId, tagIds: set });
    for (const t of set) {
      let hs = this.subsByTag.get(t);
      if (!hs) {
        hs = new Set();
        this.subsByTag.set(t, hs);
      }
      hs.add(handle);
    }
    // snapshot ban đầu cho session
    const initial: TagDelta[] = [];
    for (const t of set) {
      const v = this.current.get(t);
      if (v) initial.push({ alias: this.aliasFor(t), value: v.value, quality: v.quality, ts: v.ts });
    }
    if (initial.length > 0) this.emit(new Map([[sessionId, initial]]));
    return handle;
  }

  unsubscribe(handle: SubscriptionHandle): void {
    const sub = this.subs.get(handle);
    if (!sub) return;
    for (const t of sub.tagIds) {
      const hs = this.subsByTag.get(t);
      hs?.delete(handle);
      if (hs && hs.size === 0) this.subsByTag.delete(t);
    }
    this.subs.delete(handle);
  }

  private aliasFor(tagId: TagId): number {
    let a = this.aliasOf.get(tagId);
    if (a === undefined) {
      a = ++this.aliasSeq;
      this.aliasOf.set(tagId, a);
    }
    return a;
  }

  private shouldPublish(v: TagValue): boolean {
    const prev = this.lastPub.get(v.tagId);
    if (prev === undefined) return true;
    if (v.quality !== prev.quality) return true;
    if (typeof v.value === 'number' && typeof prev.value === 'number') {
      return Math.abs(v.value - prev.value) >= (this.deadband.get(v.tagId) ?? 0);
    }
    return v.value !== prev.value;
  }

  private emit(perSession: ReadonlyMap<string, ReadonlyArray<TagDelta>>): void {
    for (const [sid, deltas] of perSession) {
      if (deltas.length === 0) continue;
      for (const cb of this.callbacks) {
        try {
          cb(sid, deltas);
        } catch {
          // isolate
        }
      }
    }
  }
}
