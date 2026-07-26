// L2 — Historian + Replay (doc 05-04 / doc 19). Adapter MEMORY cho lát cắt (TimescaleDB là infra
// sau, cùng interface). Ghi tag theo thời gian, truy vấn có rollup/aggregate, snapshot, DATA REPLAY
// với ĐỒNG HỒ REPLAY ĐỘC LẬP (0,25×–60×, seek < 2 s). Giá trị substituted đánh dấu vĩnh viễn + audit.
import type { TagId, Quality, Iso8601 } from '@idtp/sdk';

export type HistAggregate = 'avg' | 'min' | 'max' | 'stddev' | 'count' | 'last' | 'total';
export interface HistPoint {
  ts: Iso8601;
  value: number;
  quality: Quality;
}
export interface ReplaySession {
  id: string;
  from: Iso8601;
  to: Iso8601;
  speed: number;
  clockTs: Iso8601;
}
export interface HistorianDeps {
  formatTs(ms: number): Iso8601;
}
export interface WritePoint {
  tagId: TagId;
  value: number;
  quality: Quality;
  ts: Iso8601;
}

const REPLAY_MIN = 0.25;
const REPLAY_MAX = 60;

interface Pt {
  t: number;
  v: number;
  q: Quality;
}
interface Session {
  from: number;
  to: number;
  speed: number;
  clock: number;
}

function clampSpeed(s: number): number {
  return Math.min(REPLAY_MAX, Math.max(REPLAY_MIN, s));
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
function worstQuality(pts: ReadonlyArray<Pt>): Quality {
  let q: Quality = 'Good';
  for (const p of pts) {
    if (p.q === 'Bad') return 'Bad';
    if (p.q === 'Substituted') q = 'Substituted';
    else if (p.q === 'Uncertain' && q === 'Good') q = 'Uncertain';
  }
  return q;
}
function aggregate(agg: HistAggregate, pts: ReadonlyArray<Pt>): number {
  const vals = pts.map((p) => p.v);
  const n = vals.length;
  const sum = vals.reduce((a, b) => a + b, 0);
  switch (agg) {
    case 'last':
      return vals[n - 1] ?? 0;
    case 'min':
      return Math.min(...vals);
    case 'max':
      return Math.max(...vals);
    case 'count':
      return n;
    case 'total':
      return sum;
    case 'avg':
      return n ? sum / n : 0;
    case 'stddev': {
      const m = n ? sum / n : 0;
      return n ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / n) : 0;
    }
    default:
      return vals[n - 1] ?? 0;
  }
}

export class MemoryHistorian {
  private readonly store = new Map<TagId, Pt[]>();
  private readonly snapshots: number[] = [];
  private readonly sessions = new Map<string, Session>();
  private readonly audit: { tagId: TagId; t: number; user: string; reason: string }[] = [];
  private seq = 0;

  constructor(private readonly deps: HistorianDeps) {}

  write(values: ReadonlyArray<WritePoint>): void {
    for (const v of values) {
      const t = Date.parse(v.ts);
      if (Number.isNaN(t)) continue;
      let arr = this.store.get(v.tagId);
      if (!arr) {
        arr = [];
        this.store.set(v.tagId, arr);
      }
      arr.push({ t, v: v.value, q: v.quality });
    }
  }

  query(tagId: TagId, from: Iso8601, to: Iso8601, agg: HistAggregate, bucketMs?: number): Promise<ReadonlyArray<HistPoint>> {
    const arr = this.store.get(tagId) ?? [];
    const f = Date.parse(from);
    const t = Date.parse(to);
    const inRange = arr.filter((p) => p.t >= f && p.t <= t);
    if (bucketMs === undefined || bucketMs <= 0) {
      return Promise.resolve(inRange.map((p) => ({ ts: this.deps.formatTs(p.t), value: p.v, quality: p.q })));
    }
    const buckets = new Map<number, Pt[]>();
    for (const p of inRange) {
      const b = f + Math.floor((p.t - f) / bucketMs) * bucketMs;
      const g = buckets.get(b);
      if (g) g.push(p);
      else buckets.set(b, [p]);
    }
    const out = [...buckets.entries()]
      .sort((a, z) => a[0] - z[0])
      .map(([b, pts]) => ({ ts: this.deps.formatTs(b), value: aggregate(agg, pts), quality: worstQuality(pts) }));
    return Promise.resolve(out);
  }

  snapshot(ts: Iso8601): Promise<void> {
    this.snapshots.push(Date.parse(ts));
    return Promise.resolve();
  }

  /** Giá trị lịch sử tại thời điểm (last ≤ tsMs) — nền của replay frame; binary search → seek < 2 s. */
  valueAt(tagId: TagId, tsMs: number): HistPoint | undefined {
    const arr = this.store.get(tagId);
    if (!arr || arr.length === 0) return undefined;
    let lo = 0;
    let hi = arr.length - 1;
    let res = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const el = arr[mid];
      if (el && el.t <= tsMs) {
        res = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const p = res >= 0 ? arr[res] : undefined;
    return p ? { ts: this.deps.formatTs(p.t), value: p.v, quality: p.q } : undefined;
  }

  frameAt(tsMs: number, tagIds: ReadonlyArray<TagId>): Record<string, HistPoint> {
    const out: Record<string, HistPoint> = {};
    for (const id of tagIds) {
      const p = this.valueAt(id, tsMs);
      if (p) out[id] = p;
    }
    return out;
  }

  /** Biên dữ liệu đã ghi (để mở replay/clamp seek). */
  dataRange(): { from: Iso8601; to: Iso8601 } | undefined {
    let min = Infinity;
    let max = -Infinity;
    for (const arr of this.store.values()) {
      const a = arr[0];
      const z = arr[arr.length - 1];
      if (a) min = Math.min(min, a.t);
      if (z) max = Math.max(max, z.t);
    }
    return min === Infinity ? undefined : { from: this.deps.formatTs(min), to: this.deps.formatTs(max) };
  }

  openReplay(from: Iso8601, to: Iso8601, speed: number): ReplaySession {
    const id = `rp-${++this.seq}`;
    this.sessions.set(id, { from: Date.parse(from), to: Date.parse(to), speed: clampSpeed(speed), clock: Date.parse(from) });
    return this.session(id) as ReplaySession;
  }

  seek(sessionId: string, ts: Iso8601): void {
    const s = this.sessions.get(sessionId);
    if (s) s.clock = clamp(Date.parse(ts), s.from, s.to); // clamp về biên dữ liệu
  }

  /** Tiến đồng hồ replay theo thời gian thực đã trôi × tốc độ; trả clockTs mới (clamp [from,to]). */
  advanceReplay(sessionId: string, realDtMs: number): Iso8601 | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    s.clock = clamp(s.clock + s.speed * realDtMs, s.from, s.to);
    return this.deps.formatTs(s.clock);
  }

  setSpeed(sessionId: string, speed: number): void {
    const s = this.sessions.get(sessionId);
    if (s) s.speed = clampSpeed(speed);
  }

  session(sessionId: string): ReplaySession | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    return { id: sessionId, from: this.deps.formatTs(s.from), to: this.deps.formatTs(s.to), speed: s.speed, clockTs: this.deps.formatTs(s.clock) };
  }

  closeReplay(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  substituteMark(tagId: TagId, ts: Iso8601, user: string, reason: string): void {
    const arr = this.store.get(tagId);
    const t = Date.parse(ts);
    if (arr) {
      let target: Pt | undefined;
      for (const p of arr) {
        if (p.t > t) break; // arr tăng dần theo thời gian → dừng khi vượt ts
        target = p;
      }
      if (target) target.q = 'Substituted'; // đánh dấu vĩnh viễn
    }
    this.audit.push({ tagId, t, user, reason });
  }

  auditLog(): ReadonlyArray<{ tagId: TagId; ts: Iso8601; user: string; reason: string }> {
    return this.audit.map((a) => ({ tagId: a.tagId, ts: this.deps.formatTs(a.t), user: a.user, reason: a.reason }));
  }

  size(): number {
    let n = 0;
    for (const arr of this.store.values()) n += arr.length;
    return n;
  }
}
