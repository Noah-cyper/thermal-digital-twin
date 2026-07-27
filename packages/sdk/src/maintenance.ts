// @idtp/sdk — kiểu Maintenance (doc 05-18). Plugin liên kết asset↔run-tag + ngưỡng PM (dữ liệu khai
// báo); Maintenance Engine (@idtp/engines) tích giờ chạy, đếm start, MTBF/MTTR, work order. Generic.
import type { TagId, Iso8601 } from './types';

export interface MaintenanceItemDef {
  readonly assetId: string;
  readonly runTag: TagId;
  readonly runThreshold?: number; // chạy khi tag > ngưỡng (mặc định 0,5)
  readonly pmRunningHours?: number; // tự tạo work order PM khi vượt ngưỡng giờ chạy
}

export interface EquipmentRuntime {
  readonly assetId: string;
  readonly runningHours: number;
  readonly startCount: number;
  readonly running: boolean;
  readonly lastStart?: Iso8601;
}

export type WorkOrderType = 'PM' | 'CM';
export type WorkOrderStatus = 'open' | 'in-progress' | 'done';

export interface WorkOrder {
  readonly woId: string;
  readonly assetId: string;
  readonly type: WorkOrderType;
  readonly status: WorkOrderStatus;
  readonly createdTs: Iso8601;
  readonly reason?: string;
}
