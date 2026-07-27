// L2 — Maintenance Engine (doc 05-18). Tích giờ chạy từ run-state tag, đếm số lần khởi động, MTBF/
// MTTR từ event hỏng, work order (PM/CM) có audit. Generic: plugin khai báo asset↔run-tag + ngưỡng PM.
import type {
  MaintenanceItemDef,
  EquipmentRuntime,
  WorkOrder,
  WorkOrderType,
  WorkOrderStatus,
  Iso8601,
  TagId,
} from '@idtp/sdk';

export interface MaintenanceDeps {
  formatTs(ms: number): Iso8601;
  audit?(entry: { ts: Iso8601; user: string; action: string; target: string; reason: string }): void;
}

interface Rec {
  def: MaintenanceItemDef;
  running: boolean;
  runningMs: number;
  startCount: number;
  lastStartMs?: number;
  lastSampleMs?: number;
  failures: number[]; // mốc thời gian hỏng (ms)
  repairMs: number[]; // thời lượng sửa CM (ms) → MTTR
  lastPmHours: number;
}

interface WoRec {
  woId: string;
  assetId: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  createdTs: Iso8601;
  reason?: string;
  createdMs: number;
  doneMs?: number;
}

export class MaintenanceEngine {
  private readonly recs = new Map<string, Rec>();
  private readonly wos: WoRec[] = [];
  private seq = 0;

  constructor(
    items: ReadonlyArray<MaintenanceItemDef>,
    private readonly deps: MaintenanceDeps,
  ) {
    for (const def of items) {
      this.recs.set(def.assetId, { def, running: false, runningMs: 0, startCount: 0, failures: [], repairMs: [], lastPmHours: 0 });
    }
  }

  /** Lấy mẫu run-state mỗi bước: tích giờ chạy, đếm start, tự tạo PM khi vượt ngưỡng giờ chạy. */
  sample(getTag: (id: TagId) => number, nowMs: number): void {
    for (const rec of this.recs.values()) {
      const isRun = getTag(rec.def.runTag) > (rec.def.runThreshold ?? 0.5);
      if (rec.lastSampleMs !== undefined && rec.running) rec.runningMs += nowMs - rec.lastSampleMs;
      rec.lastSampleMs = nowMs;
      if (isRun && !rec.running) {
        rec.startCount += 1;
        rec.lastStartMs = nowMs;
      }
      rec.running = isRun;
      const hrs = rec.runningMs / 3_600_000;
      if (rec.def.pmRunningHours !== undefined && hrs - rec.lastPmHours >= rec.def.pmRunningHours) {
        rec.lastPmHours = hrs;
        this.createWorkOrder({ assetId: rec.def.assetId, type: 'PM', reason: `PM định kỳ ${rec.def.pmRunningHours} h chạy` }, 'system', nowMs);
      }
    }
  }

  runtime(assetId: string): EquipmentRuntime {
    const rec = this.recs.get(assetId);
    if (!rec) return { assetId, runningHours: 0, startCount: 0, running: false };
    return {
      assetId,
      runningHours: rec.runningMs / 3_600_000,
      startCount: rec.startCount,
      running: rec.running,
      lastStart: rec.lastStartMs !== undefined ? this.deps.formatTs(rec.lastStartMs) : undefined,
    };
  }

  allRuntime(): ReadonlyArray<EquipmentRuntime> {
    return [...this.recs.keys()].map((id) => this.runtime(id));
  }

  /** Event hỏng (từ Alarm) → phục vụ MTBF/MTTR. */
  recordFailure(assetId: string, nowMs: number): void {
    this.recs.get(assetId)?.failures.push(nowMs);
  }

  /** MTBF (giờ) = tổng giờ chạy / số lần hỏng (classic). 0 lần hỏng → trả giờ chạy hiện tại. */
  mtbf(assetId: string): number {
    const rec = this.recs.get(assetId);
    if (!rec) return 0;
    const hrs = rec.runningMs / 3_600_000;
    return rec.failures.length > 0 ? hrs / rec.failures.length : hrs;
  }

  /** MTTR (giờ) = trung bình thời lượng sửa CM đã đóng. */
  mttr(assetId: string): number {
    const rec = this.recs.get(assetId);
    if (!rec || rec.repairMs.length === 0) return 0;
    return rec.repairMs.reduce((a, b) => a + b, 0) / rec.repairMs.length / 3_600_000;
  }

  createWorkOrder(wo: { assetId: string; type: WorkOrderType; reason?: string }, user: string, nowMs: number): WorkOrder {
    const rec: WoRec = {
      woId: `WO-${++this.seq}`,
      assetId: wo.assetId,
      type: wo.type,
      status: 'open',
      createdTs: this.deps.formatTs(nowMs),
      reason: wo.reason,
      createdMs: nowMs,
    };
    this.wos.push(rec);
    this.deps.audit?.({ ts: rec.createdTs, user, action: 'maintenance', target: rec.woId, reason: `create ${wo.type} ${wo.assetId}` });
    return this.snapshot(rec);
  }

  updateWorkOrder(woId: string, status: WorkOrderStatus, user: string, nowMs: number): WorkOrder | { error: string } {
    const rec = this.wos.find((w) => w.woId === woId);
    if (!rec) return { error: `work order không tồn tại: ${woId}` };
    rec.status = status;
    if (status === 'done' && rec.doneMs === undefined) {
      rec.doneMs = nowMs;
      if (rec.type === 'CM') this.recs.get(rec.assetId)?.repairMs.push(nowMs - rec.createdMs); // MTTR
    }
    this.deps.audit?.({ ts: this.deps.formatTs(nowMs), user, action: 'maintenance', target: woId, reason: `status → ${status}` });
    return this.snapshot(rec);
  }

  workOrders(): ReadonlyArray<WorkOrder> {
    return this.wos.map((w) => this.snapshot(w));
  }

  private snapshot(rec: WoRec): WorkOrder {
    return { woId: rec.woId, assetId: rec.assetId, type: rec.type, status: rec.status, createdTs: rec.createdTs, reason: rec.reason };
  }
}
