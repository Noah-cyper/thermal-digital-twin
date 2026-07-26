// L2 — Control Engine PID (doc 05-06). Anti-windup back-calculation, bumpless MAN/AUTO/CASCADE,
// derivative-on-PV, feedforward (cho vòng 3-element).
import type { LoopMode } from '@idtp/sdk';

export interface PidConfig {
  kp: number;
  ki: number;
  kd: number;
  outLo: number;
  outHi: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class PidController {
  private integral = 0;
  private prevPv = 0;
  private out = 0;
  private manOut = 0;
  private mode: LoopMode = 'MAN';
  private started = false;
  private lastFf = 0;

  constructor(private readonly cfg: PidConfig) {}

  getMode(): LoopMode {
    return this.mode;
  }

  getOutput(): number {
    return this.out;
  }

  /** Chuyển mode bumpless: giữ output liên tục, tracking integral để không giật. */
  setMode(mode: LoopMode): void {
    if (mode === this.mode) return;
    if (mode !== 'MAN') {
      // vào AUTO/CASCADE bumpless: integral = output − feedforward gần nhất (để out giữ nguyên khi
      // err≈0; nếu bỏ FF sẽ cộng đôi FF + integral).
      this.integral = this.out - this.lastFf;
    } else {
      this.manOut = this.out;
    }
    this.mode = mode;
  }

  setManualOutput(v: number): void {
    this.manOut = clamp(v, this.cfg.outLo, this.cfg.outHi);
    if (this.mode === 'MAN') this.out = this.manOut;
  }

  /** Một bước PID. ff = feedforward (vd steam flow trong 3-element). */
  step(pv: number, sp: number, dtSec: number, ff = 0): number {
    if (!this.started) {
      this.prevPv = pv;
      this.started = true;
    }
    this.lastFf = ff; // lưu để bumpless transfer trừ đúng phần FF
    if (this.mode === 'MAN') {
      this.out = clamp(this.manOut, this.cfg.outLo, this.cfg.outHi);
      this.prevPv = pv;
      return this.out;
    }
    const err = sp - pv;
    const p = this.cfg.kp * err;
    const d = dtSec > 0 ? -this.cfg.kd * ((pv - this.prevPv) / dtSec) : 0;
    this.integral += this.cfg.ki * err * dtSec;
    const raw = ff + p + this.integral + d;
    const clamped = clamp(raw, this.cfg.outLo, this.cfg.outHi);
    // anti-windup back-calculation: kéo integral lại khi output bão hoà
    if (raw !== clamped) this.integral += clamped - raw;
    this.out = clamped;
    this.prevPv = pv;
    return this.out;
  }
}
