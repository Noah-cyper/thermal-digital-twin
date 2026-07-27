// @idtp/engines — SequenceEngine (doc 09, ISA-88 SFC). Chạy SequenceDef KHAI BÁO của plugin: vào
// bước khi permissive đúng → ghi actions (audit) → chờ transition + holdMs → bước kế; timeout → failed.
// GENERIC: không hiểu biết plant. Tất định (theo đồng hồ inject, không Date.now).
import type { IWriteCommand, SeqCondition, SeqRunState, SeqRunStatus, SequenceDef, SeqStepDef } from '@idtp/sdk';

export interface SequenceIo {
  getTag(tagId: string): number | boolean;
  command(cmd: IWriteCommand): void; // writer chịu trách nhiệm audit/RBAC
  now(): number; // epoch ms từ Time Service
}

function num(v: number | boolean): number {
  return typeof v === 'boolean' ? (v ? 1 : 0) : v;
}
function condOk(c: SeqCondition, io: SequenceIo): boolean {
  const a = num(io.getTag(c.tag));
  switch (c.op) {
    case 'gt': return a > c.value;
    case 'lt': return a < c.value;
    case 'ge': return a >= c.value;
    case 'le': return a <= c.value;
    case 'eq': return a === c.value;
    case 'ne': return a !== c.value;
  }
}
function allOk(cs: ReadonlyArray<SeqCondition>, io: SequenceIo): boolean {
  for (const c of cs) if (!condOk(c, io)) return false;
  return true;
}

export class SequenceEngine {
  private status: SeqRunStatus = 'idle';
  private stepIndex = -1;
  private enteredMs = 0;
  private message: string | null = null;

  constructor(
    private readonly def: SequenceDef,
    private readonly io: SequenceIo,
  ) {}

  /** Bắt đầu chuỗi: vào bước 0 nếu permissive đúng, ngược lại failed. */
  start(): SeqRunState {
    if (this.def.steps.length === 0) {
      this.status = 'done';
      return this.state();
    }
    this.status = 'running';
    this.stepIndex = -1;
    this.message = null;
    this.enter(0);
    return this.state();
  }

  private enter(index: number): void {
    const step = this.def.steps[index];
    if (!step) {
      this.status = 'done';
      return;
    }
    if (!allOk(step.permissive, this.io)) {
      this.fail(`permissive không thoả tại bước '${step.stepId}'`);
      return;
    }
    this.stepIndex = index;
    this.enteredMs = this.io.now();
    for (const a of step.actions) {
      this.io.command({ tagId: a.tag, value: a.value, user: 'sequence', reason: `${this.def.sequenceId}/${step.stepId}: ${a.reason}` });
    }
  }

  private fail(msg: string): void {
    this.status = this.def.abortOnFail ? 'aborted' : 'failed';
    this.message = msg;
  }

  /** Nhịp: kiểm tra done/timeout của bước hiện tại; chuyển bước hoặc kết thúc. */
  tick(): SeqRunState {
    if (this.status !== 'running') return this.state();
    const step: SeqStepDef | undefined = this.def.steps[this.stepIndex];
    if (!step) {
      this.status = 'done';
      return this.state();
    }
    const elapsed = this.io.now() - this.enteredMs;
    const complete = elapsed >= step.holdMs && allOk(step.transition, this.io);
    if (complete) {
      if (this.stepIndex >= this.def.steps.length - 1) this.status = 'done';
      else this.enter(this.stepIndex + 1);
    } else if (step.timeoutMs > 0 && elapsed > step.timeoutMs) {
      this.fail(`timeout bước '${step.stepId}' (${step.timeoutMs} ms)`);
    }
    return this.state();
  }

  abort(): SeqRunState {
    if (this.status === 'running') {
      this.status = 'aborted';
      this.message = 'abort thủ công';
    }
    return this.state();
  }

  state(): SeqRunState {
    const step = this.def.steps[this.stepIndex];
    return { status: this.status, stepIndex: this.stepIndex, stepId: step?.stepId ?? null, message: this.message };
  }

  get sequenceId(): string {
    return this.def.sequenceId;
  }
}
