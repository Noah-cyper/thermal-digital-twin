// L2 — Faceplate Engine (doc 05-15). Ráp dữ liệu 4 tab (Overview/Alarm/Detail đồng bộ; Trend do
// Historian phục vụ riêng) từ resolver các engine khác. Generic: plugin khai báo FaceplateDef,
// engine không biết thiết bị cụ thể. Hiện lý do bị chặn (interlock) trên Detail; lệnh bị chặn hiện
// blockedReason ở tầng Control/Security.
import type { FaceplateDef, LoopMode, Quality, TagId, Priority, AlarmCondition } from '@idtp/sdk';

export interface FaceplateResolvers {
  read(tag: TagId): { value: number; quality: Quality } | undefined;
  loopMode(loopId: string): LoopMode | undefined;
  loopOutput(loopId: string): number | undefined;
  alarmDef(alarmId: string): { priority: Priority; condition: AlarmCondition; setpoint: number } | undefined;
  activeAlarmIds(): ReadonlySet<string>;
  runtime(assetId: string): { runningHours: number; startCount: number } | undefined;
  blockedReason(assetId: string): string | null;
}

export interface FaceplateOverview {
  pv: number | null;
  quality: Quality | 'None';
  sp: number | null;
  op: number | null;
  mode: LoopMode | null;
}
export interface FaceplateAlarmRow {
  alarmId: string;
  priority: Priority | '?';
  condition: AlarmCondition | '?';
  setpoint: number;
  active: boolean;
}
export interface FaceplateDetail {
  kks?: string;
  eu?: string;
  rangeLo?: number;
  rangeHi?: number;
  runningHours?: number;
  startCount?: number;
  blockedReason: string | null;
}

export class FaceplateEngine {
  private readonly defs = new Map<string, FaceplateDef>();

  constructor(defs: ReadonlyArray<FaceplateDef>) {
    for (const d of defs) this.defs.set(d.assetId, d);
  }

  open(assetId: string): FaceplateDef | undefined {
    return this.defs.get(assetId);
  }

  list(): ReadonlyArray<FaceplateDef> {
    return [...this.defs.values()];
  }

  overview(def: FaceplateDef, r: FaceplateResolvers): FaceplateOverview {
    const pv = r.read(def.pvTag);
    const sp = def.spTag !== undefined ? r.read(def.spTag)?.value ?? null : def.sp ?? null;
    const op = def.opTag !== undefined ? r.read(def.opTag)?.value ?? null : def.loopId !== undefined ? r.loopOutput(def.loopId) ?? null : null;
    return {
      pv: pv?.value ?? null,
      quality: pv?.quality ?? 'None',
      sp,
      op,
      mode: def.loopId !== undefined ? r.loopMode(def.loopId) ?? null : null,
    };
  }

  alarms(def: FaceplateDef, r: FaceplateResolvers): FaceplateAlarmRow[] {
    const active = r.activeAlarmIds();
    return (def.alarmIds ?? []).map((id) => {
      const a = r.alarmDef(id);
      return { alarmId: id, priority: a?.priority ?? '?', condition: a?.condition ?? '?', setpoint: a?.setpoint ?? 0, active: active.has(id) };
    });
  }

  detail(def: FaceplateDef, r: FaceplateResolvers): FaceplateDetail {
    const rt = r.runtime(def.assetId);
    return {
      kks: def.kks,
      eu: def.eu,
      rangeLo: def.rangeLo,
      rangeHi: def.rangeHi,
      runningHours: rt?.runningHours,
      startCount: rt?.startCount,
      blockedReason: r.blockedReason(def.assetId),
    };
  }
}
