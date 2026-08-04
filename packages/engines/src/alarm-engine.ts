// L2 — Alarm Engine (doc 05-03, ISA-18.2 / EEMUA 191). Chạy AlarmDef KHAI BÁO của plugin:
// state machine đầy đủ (Normal·UnackAlarm·AckAlarm·RtnUnack·Shelved·Suppressed·OutOfService),
// deadband hysteresis + on/off delay chống chattering, shelving ≤ 8 h tự bung, suppression theo
// trạng thái thiết bị, KPI (rate/flood/bad-actor). Generic: plugin nào cũng nạp alarm của nó.
import type { TagId, Quality, Iso8601, AlarmDef, AlarmEvent, AlarmStateName, AlarmCondition, Priority } from '@idtp/sdk';

const MAX_SHELVE_MIN = 480; // 8 h (EEMUA 191)
const KPI_WINDOW_MS = 600_000; // 10 phút
const FLOOD_THRESHOLD = 10; // > 10 alarm / 10 phút

export interface AlarmEngineDeps {
  formatTs(nowMs: number): Iso8601;
}

export interface AlarmKpi {
  ratePer10Min: number;
  flood: boolean;
  active: number;
  byPriority: Record<Priority, number>;
  badActors: ReadonlyArray<{ alarmId: string; count: number }>;
}

export type ShelveResult = AlarmEvent | { blockedReason: string };

/** Một alarm đang shelve (ISA-18.2) — kèm lý do, người shelve, thời điểm & hạn tự bung. */
export interface ShelvedAlarm {
  alarmId: string;
  priority: Priority;
  reason: string;
  user: string;
  shelvedAt: Iso8601;
  until: Iso8601;
  remainingMin: number;
}

interface St {
  state: AlarmStateName;
  condActive: boolean;
  rawState: boolean;
  rawSince: number;
  shelfUntil?: number;
  shelveReason?: string;
  shelvedBy?: string;
  shelvedAtMs?: number;
  count: number;
  lastValue?: number;
  lastChangeMs: number;
}

const ACTIVE_STATES: ReadonlyArray<AlarmStateName> = ['UnackAlarm', 'AckAlarm', 'RtnUnack'];

function condRaw(cond: AlarmCondition, value: number, sp: number, db: number, active: boolean): boolean {
  switch (cond) {
    case 'HH':
    case 'H':
    case 'DEV':
    case 'ROC':
      return active ? value >= sp - db : value >= sp;
    case 'L':
    case 'LL':
      return active ? value <= sp + db : value <= sp;
    case 'DISCRETE':
      return value !== 0;
    default:
      return false;
  }
}

export class AlarmEngine {
  private readonly defs = new Map<string, AlarmDef>();
  private readonly byTag = new Map<TagId, string[]>();
  private readonly st = new Map<string, St>();
  private readonly cbs: ((e: AlarmEvent) => void)[] = [];
  private readonly activations: { alarmId: string; ms: number }[] = [];
  private suppress: (cond: string) => boolean = () => false;

  constructor(
    defs: ReadonlyArray<AlarmDef>,
    private readonly deps: AlarmEngineDeps,
  ) {
    for (const d of defs) {
      this.defs.set(d.alarmId, d);
      this.st.set(d.alarmId, { state: 'Normal', condActive: false, rawState: false, rawSince: 0, count: 0, lastChangeMs: 0 });
      const arr = this.byTag.get(d.tagId);
      if (arr) arr.push(d.alarmId);
      else this.byTag.set(d.tagId, [d.alarmId]);
    }
  }

  /** Composition cung cấp bộ đánh giá suppression (map biểu thức "unit_state == SHUTDOWN" → bool). */
  setSuppressionEvaluator(fn: (cond: string) => boolean): void {
    this.suppress = fn;
  }

  onTransition(cb: (e: AlarmEvent) => void): void {
    this.cbs.push(cb);
  }

  evaluate(tagId: TagId, value: number | boolean, quality: Quality, nowMs: number): void {
    const ids = this.byTag.get(tagId);
    if (!ids) return;
    const v = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    for (const id of ids) {
      const def = this.defs.get(id);
      const s = this.st.get(id);
      if (!def || !s) continue;

      if (s.state === 'OutOfService') continue;
      if (s.state === 'Shelved') {
        if (s.shelfUntil !== undefined && nowMs >= s.shelfUntil) {
          s.shelfUntil = undefined;
          s.shelveReason = undefined;
          s.shelvedBy = undefined;
          s.shelvedAtMs = undefined;
          this.transition(id, 'Normal', nowMs, v);
        } else continue;
      }
      if (def.suppressWhen !== undefined && this.suppress(def.suppressWhen)) {
        if (s.state !== 'Suppressed') this.transition(id, 'Suppressed', nowMs, v);
        continue;
      }
      if (s.state === 'Suppressed') this.transition(id, 'Normal', nowMs, v);
      if (quality === 'Bad' || quality === 'Uncertain') continue; // không phát process alarm khi tín hiệu xấu

      const raw = condRaw(def.condition, v, def.setpoint, def.deadband, s.condActive);
      if (raw !== s.rawState) {
        s.rawState = raw;
        s.rawSince = nowMs;
      }
      const elapsed = nowMs - s.rawSince;
      if (!s.condActive && raw && elapsed >= def.onDelayMs) this.setCondActive(id, true, nowMs, v);
      else if (s.condActive && !raw && elapsed >= def.offDelayMs) this.setCondActive(id, false, nowMs, v);
      s.lastValue = v;
    }
  }

  ack(alarmId: string, user: string, nowMs: number): AlarmEvent {
    const s = this.st.get(alarmId);
    const def = this.defs.get(alarmId);
    if (!s || !def) return { alarmId, state: 'Normal', priority: 'P4', ts: this.deps.formatTs(nowMs), user };
    if (s.state === 'UnackAlarm') return this.transition(alarmId, 'AckAlarm', nowMs, s.lastValue, false, user);
    if (s.state === 'RtnUnack') return this.transition(alarmId, 'Normal', nowMs, s.lastValue, false, user);
    return { alarmId, state: s.state, priority: def.priority, ts: this.deps.formatTs(nowMs), value: s.lastValue, user };
  }

  shelve(alarmId: string, user: string, durationMin: number, reason: string, nowMs: number): ShelveResult {
    const s = this.st.get(alarmId);
    if (!s) return { blockedReason: `alarm không tồn tại: ${alarmId}` };
    if (durationMin <= 0) return { blockedReason: 'thời hạn shelve phải > 0' };
    if (durationMin > MAX_SHELVE_MIN) return { blockedReason: `shelve tối đa ${MAX_SHELVE_MIN} phút (8 h)` };
    const trimmed = reason.trim();
    if (trimmed.length === 0) return { blockedReason: 'shelve phải có lý do (ISA-18.2)' };
    s.shelfUntil = nowMs + durationMin * 60_000;
    s.shelveReason = trimmed;
    s.shelvedBy = user;
    s.shelvedAtMs = nowMs;
    return this.transition(alarmId, 'Shelved', nowMs, s.lastValue, false, user);
  }

  /** Bung shelve THỦ CÔNG trước hạn (đưa về Normal → lần evaluate kế sẽ tái kích nếu điều kiện còn). */
  unshelve(alarmId: string, user: string, nowMs: number): ShelveResult {
    const s = this.st.get(alarmId);
    if (!s) return { blockedReason: `alarm không tồn tại: ${alarmId}` };
    if (s.state !== 'Shelved') return { blockedReason: `alarm không ở trạng thái Shelved: ${alarmId}` };
    s.shelfUntil = undefined;
    s.shelveReason = undefined;
    s.shelvedBy = undefined;
    s.shelvedAtMs = undefined;
    return this.transition(alarmId, 'Normal', nowMs, s.lastValue, false, user);
  }

  /** Danh sách alarm đang shelve (ISA-18.2) — kèm lý do, người shelve, thời gian còn lại. */
  getShelved(nowMs: number): ReadonlyArray<ShelvedAlarm> {
    const out: ShelvedAlarm[] = [];
    for (const [id, s] of this.st) {
      if (s.state !== 'Shelved' || s.shelfUntil === undefined) continue;
      const def = this.defs.get(id);
      if (!def) continue;
      out.push({
        alarmId: id,
        priority: def.priority,
        reason: s.shelveReason ?? '',
        user: s.shelvedBy ?? '',
        shelvedAt: this.deps.formatTs(s.shelvedAtMs ?? nowMs),
        until: this.deps.formatTs(s.shelfUntil),
        remainingMin: Math.max(0, Math.ceil((s.shelfUntil - nowMs) / 60_000)),
      });
    }
    return out;
  }

  outOfService(alarmId: string, user: string, on: boolean, nowMs: number): AlarmEvent {
    return this.transition(alarmId, on ? 'OutOfService' : 'Normal', nowMs, undefined, false, user);
  }

  getActive(): ReadonlyArray<AlarmEvent> {
    const out: AlarmEvent[] = [];
    for (const [id, s] of this.st) {
      if (!ACTIVE_STATES.includes(s.state)) continue;
      const def = this.defs.get(id);
      if (!def) continue;
      out.push({ alarmId: id, state: s.state, priority: def.priority, ts: this.deps.formatTs(s.lastChangeMs), value: s.lastValue });
    }
    return out;
  }

  kpi(nowMs: number): AlarmKpi {
    while (this.activations.length > 0 && nowMs - (this.activations[0]?.ms ?? nowMs) > KPI_WINDOW_MS) this.activations.shift();
    const byPriority: Record<Priority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
    let active = 0;
    for (const [id, s] of this.st) {
      const def = this.defs.get(id);
      if (def) byPriority[def.priority] += 1;
      if (ACTIVE_STATES.includes(s.state)) active += 1;
    }
    const badActors = [...this.st.entries()]
      .map(([alarmId, s]) => ({ alarmId, count: s.count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return { ratePer10Min: this.activations.length, flood: this.activations.length > FLOOD_THRESHOLD, active, byPriority, badActors };
  }

  private setCondActive(id: string, active: boolean, nowMs: number, v: number): void {
    const s = this.st.get(id);
    if (!s) return;
    s.condActive = active;
    if (active) {
      if (s.state === 'Normal' || s.state === 'RtnUnack') this.transition(id, 'UnackAlarm', nowMs, v, true);
    } else if (s.state === 'UnackAlarm') {
      this.transition(id, 'RtnUnack', nowMs, v);
    } else if (s.state === 'AckAlarm') {
      this.transition(id, 'Normal', nowMs, v);
    }
  }

  private transition(id: string, next: AlarmStateName, nowMs: number, value?: number, activation = false, user?: string): AlarmEvent {
    const s = this.st.get(id);
    const def = this.defs.get(id);
    if (!s || !def) return { alarmId: id, state: next, priority: 'P4', ts: this.deps.formatTs(nowMs), value, user };
    s.state = next;
    s.lastChangeMs = nowMs;
    if (activation) {
      s.count += 1;
      this.activations.push({ alarmId: id, ms: nowMs });
    }
    const e: AlarmEvent = { alarmId: id, state: next, priority: def.priority, ts: this.deps.formatTs(nowMs), value, user };
    for (const cb of this.cbs) cb(e);
    return e;
  }
}
