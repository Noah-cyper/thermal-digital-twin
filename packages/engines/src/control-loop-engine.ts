// L2 — Control Loop Engine (doc 05-06 / doc 09). Chạy các ControlLoopDef KHAI BÁO của plugin bằng
// PidController. Generic: engine KHÔNG biết plant cụ thể — plugin nào cũng nạp loop của nó qua đây,
// nên thêm plugin mới không phải sửa engine (bài test generic Pha D).
import type { ControlLoopDef, TagId, LoopMode } from '@idtp/sdk';
import { PidController } from './control';

export interface LoopReadCtx {
  getTag(tagId: TagId): number;
}
export interface LoopOutput {
  outTag: TagId;
  value: number;
}

interface Loop {
  def: ControlLoopDef;
  pid: PidController;
}

export class ControlLoopEngine {
  private readonly loops: Loop[] = [];
  private readonly byId = new Map<string, PidController>();

  constructor(defs: ReadonlyArray<ControlLoopDef>) {
    for (const def of defs) {
      const pid = new PidController({ kp: def.kp, ki: def.ki, kd: def.kd, outLo: def.outLo, outHi: def.outHi });
      pid.setMode(def.mode ?? 'AUTO');
      this.loops.push({ def, pid });
      this.byId.set(def.id, pid);
    }
  }

  /** Một bước cho mọi loop: đọc PV/SP/FF từ tag → tính OP. KHÔNG tự ghi tag (composition ghi). */
  step(ctx: LoopReadCtx, dtSec: number): LoopOutput[] {
    const out: LoopOutput[] = [];
    for (const { def, pid } of this.loops) {
      const pv = ctx.getTag(def.pvTag);
      let sp: number;
      if (def.sp !== undefined) sp = def.sp;
      else if (def.spTag !== undefined) sp = ctx.getTag(def.spTag) * (def.spScale ?? 1);
      else sp = 0;
      const ff = def.ffTag !== undefined ? ctx.getTag(def.ffTag) * (def.ffGain ?? 1) : 0;
      // reverse-acting: đảo dấu PV/SP để bộ điều khiển tác động ngược (err = PV−SP), FF giữ nguyên.
      const s = def.reverse ? -1 : 1;
      out.push({ outTag: def.outTag, value: pid.step(s * pv, s * sp, dtSec, ff) });
    }
    return out;
  }

  setMode(loopId: string, mode: LoopMode): void {
    this.byId.get(loopId)?.setMode(mode);
  }
  setManualOutput(loopId: string, value: number): void {
    this.byId.get(loopId)?.setManualOutput(value);
  }
  getMode(loopId: string): LoopMode | undefined {
    return this.byId.get(loopId)?.getMode();
  }
  getOutput(loopId: string): number | undefined {
    return this.byId.get(loopId)?.getOutput();
  }
  loopIds(): ReadonlyArray<string> {
    return this.loops.map((l) => l.def.id);
  }
}
