# 05‑06 — Control Engine (L2, PID/SFC)

> Đặc tả theo khung 10 mục §8. Types: `@idtp/sdk`. Loop cụ thể (Boiler master, Drum level
> 3‑element…) → doc 09. SFC theo **tinh thần** IEC 61131‑3.

## 1. Mục đích & ranh giới trách nhiệm

Chạy **PID** (anti‑windup + bumpless MAN/AUTO/CASCADE), chạy **SFC/sequence**, đánh giá
**permissive & interlock là first‑class object** (hiển thị được **lý do bị chặn**). Ghi setpoint/output
qua SDK (audit + xác nhận 2 bước cho lệnh nguy hiểm).

| KHÔNG thuộc engine này | Thuộc về |
|---|---|
| Vật lý quá trình | Simulation (05‑05) — Control **đọc** PV, **ghi** OP |
| Logic alarm | Alarm (05‑03) |
| Giá trị thô | Tag/Realtime (05‑01) |
| Lưu lịch sử loop | Historian (05‑04) |

## 2. Interface công bố

```typescript
import type { TagId, LoopMode, IWriteCommand, WriteResult } from '@idtp/sdk';

export interface PidConfig {
  loopId: string; pv: TagId; sp: TagId; out: TagId;
  kp: number; ki: number; kd: number;
  outLo: number; outHi: number;                 // anti-windup clamp
  mode: LoopMode; cascadeFrom?: string;         // loopId master khi CASCADE
}
export interface Interlock { id: string; expr: string; blocks: 'start' | 'run'; reason: { vi: string; en: string }; }

export interface IControlEngine {
  execute(loopId: string, dtMs: number): void;                         // 1 bước PID
  setMode(loopId: string, mode: LoopMode, user: string): WriteResult;  // bumpless
  setSetpoint(cmd: IWriteCommand): WriteResult;                        // audit + 2-step
  evalInterlock(id: string): { active: boolean; reason?: string };
  getBlockedReason(loopId: string): string | null;
  onLoop(cb: (loopId: string, pv: number, sp: number, out: number, mode: LoopMode) => void): void;
}
```

## 3. Mô hình dữ liệu nội bộ

| Cấu trúc | Vai trò |
|---|---|
| `loops: Map<loopId, PidConfig>` | cấu hình loop (từ plugin) |
| `pidState` | `integral`, `prevErr`, `prevPv` (derivative‑on‑PV) |
| `mode` | MAN/AUTO/CASCADE + giá trị tracking (bumpless) |
| `interlocks: Map<id, Interlock>` | interlock first‑class |
| `blocked: Map<loopId, reason>` | lý do đang chặn (hiển thị được) |

## 4. Luồng xử lý

```mermaid
sequenceDiagram
  participant CE as Control
  participant TR as Tag/Realtime
  participant SM as Simulation
  CE->>TR: đọc PV
  CE->>CE: err = SP - PV; PID (P + I + D on PV)
  CE->>CE: clamp OUT [outLo,outHi] + back-calculation anti-windup
  CE->>CE: evalInterlock → nếu active: giữ OUT an toàn + set blockedReason
  CE->>SM: ghi OUT (nếu không bị chặn)
  CE->>CE: onLoop(pv,sp,out,mode)
```

## 5. Cấu hình (YAML + ví dụ — Drum level 3‑element)

```yaml
loop:
  loopId: PID-001-drum-level
  pv: BLR_DRUM_LEVEL_01
  sp: BLR_DRUM_LEVEL_SP
  out: BLR_FW_CV_01
  kp: 1.2
  ki: 0.05
  kd: 0.0
  outLo: 0
  outHi: 100
  mode: CASCADE
  feedforward: [BLR_STEAM_FLOW_01, BLR_FW_FLOW_01]   # 3-element
interlock:
  id: ILK-FW-CV-001
  expr: "BLR_DRUM_LEVEL_01 > 250"      # HH → chặn mở thêm van cấp
  blocks: run
  reason: { vi: "Mức bao hơi HH", en: "Drum level HH" }
```

## 6. Chỉ tiêu phi chức năng

| Chỉ tiêu | Mục tiêu |
|---|---|
| Chu kỳ loop | theo scan class (fast 250 ms / process 500 ms) |
| Bumpless transfer | không nhảy OP khi đổi MAN↔AUTO↔CASCADE |
| Anti‑windup | không overshoot khi OUT bão hoà |
| Tính tất định | dùng dt cố định (tái lập replay/re‑sim) |

## 7. Chế độ lỗi & phục hồi

| Sự cố | Hệ quả | Phục hồi |
|---|---|---|
| PV bad quality | loop mù | giữ OUT + **đóng băng integral** |
| Interlock active | không được ghi | ép trạng thái an toàn + hiện `blockedReason` |
| Master (cascade) lỗi | mất SP tầng trên | rơi về AUTO với SP local cuối |
| OUT bão hoà | windup | back‑calculation |

## 8. Cách plugin mở rộng

Plugin cung cấp `control/*.yaml` (PID params, cascade, feedforward, interlock) + `ISequenceStep` cho
SFC (purge/start‑up). **Không** viết code engine.

## 9. Kế hoạch kiểm thử

| Loại | Nội dung |
|---|---|
| Unit | toán PID; anti‑windup back‑calc; bumpless tracking; derivative‑on‑PV |
| Integration | loop khép kín trên Simulation → ramp tải ổn định |
| Scenario | giữ drum level khi đổi tải ±5%/phút (swell/shrink) |

## 10. Quyết định & phương án đã loại bỏ

| Quyết định | Chọn | Loại bỏ | Lý do |
|---|---|---|---|
| Đạo hàm | **Derivative‑on‑PV** | Derivative‑on‑error | Tránh derivative kick khi đổi SP |
| Anti‑windup | **Back‑calculation** | Chỉ clamp | Thoát bão hoà mượt hơn |
| Interlock | **First‑class object** | Điều kiện inline | Hiển thị được **lý do bị chặn** |
| Chuyển mode | **Tracking (bumpless)** | Chuyển thẳng | Không giật OP, an toàn vận hành |
