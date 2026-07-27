// Plugin thermal-power-600 — liên kết asset↔run-tag + ngưỡng PM (doc 05-18). Dữ liệu khai báo, chỉ
// import type từ @idtp/sdk. Maintenance Engine generic tích giờ chạy. Ngưỡng PM [GIẢ ĐỊNH] (doc 25).
import type { MaintenanceItemDef } from '@idtp/sdk';

export const thermalMaintenance: ReadonlyArray<MaintenanceItemDef> = [
  { assetId: 'UNIT1', runTag: 'GEN_MW_01', runThreshold: 10, pmRunningHours: 8000 },
  { assetId: 'MILL_GROUP', runTag: 'BLR_COAL_FLOW_01', runThreshold: 10, pmRunningHours: 2000 },
  { assetId: 'BFP', runTag: 'BLR_FW_FLOW_01', runThreshold: 10, pmRunningHours: 4000 },
];
