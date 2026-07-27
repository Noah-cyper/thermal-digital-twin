// Kernel L1 — Time Service (doc 05-14). Nguồn thời gian duy nhất: now()=UTC+offset,
// monotonicMs() tách wall-clock (NTP nhảy không hỏng solver), replay clock độc lập.
import type { Iso8601 } from '@idtp/sdk';

export interface IReplayClock {
  at(): Iso8601;
  setSpeed(factor: number): void;
  seek(ts: Iso8601): void;
}

export interface ITimeService {
  now(): Iso8601;
  monotonicMs(): number;
  offset(): string;
  formatEpoch(epochMs: number): Iso8601;
  replayClock(from?: Iso8601): IReplayClock;
}

export interface TimeServiceConfig {
  /** vd "+07:00" (mặc định) */
  offset?: string;
}

function parseOffset(s: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`offset không hợp lệ: ${s}`);
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

const REPLAY_MIN = 0.25;
const REPLAY_MAX = 60;

export class TimeService implements ITimeService {
  private readonly offsetStr: string;
  private readonly offsetMin: number;

  constructor(cfg: TimeServiceConfig = {}) {
    this.offsetStr = cfg.offset ?? '+07:00';
    this.offsetMin = parseOffset(this.offsetStr);
  }

  now(): Iso8601 {
    return this.formatEpoch(Date.now());
  }

  monotonicMs(): number {
    return Math.round(performance.now());
  }

  offset(): string {
    return this.offsetStr;
  }

  formatEpoch(epochMs: number): Iso8601 {
    const d = new Date(epochMs + this.offsetMin * 60_000);
    const p = (n: number): string => String(n).padStart(2, '0');
    return (
      `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
      `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}${this.offsetStr}`
    );
  }

  replayClock(from?: Iso8601): IReplayClock {
    return new ReplayClock(this, from);
  }
}

class ReplayClock implements IReplayClock {
  private baseTs: number;
  private wallAtSet: number;
  private speed = 1;

  constructor(
    private readonly time: TimeService,
    from?: Iso8601,
  ) {
    this.baseTs = from ? Date.parse(from) : Date.now();
    this.wallAtSet = performance.now();
  }

  at(): Iso8601 {
    const elapsed = (performance.now() - this.wallAtSet) * this.speed;
    return this.time.formatEpoch(this.baseTs + elapsed);
  }

  setSpeed(factor: number): void {
    this.baseTs = Date.parse(this.at());
    this.wallAtSet = performance.now();
    this.speed = Math.min(REPLAY_MAX, Math.max(REPLAY_MIN, factor));
  }

  seek(ts: Iso8601): void {
    this.baseTs = Date.parse(ts);
    this.wallAtSet = performance.now();
  }
}
