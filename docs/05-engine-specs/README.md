# 05 — Engine Specs (Đặc tả engine) — Index

> Tài liệu #05/00–25 (§8 prompt cha), **tách theo engine** (một file/engine vì vượt 4.000 từ).
> Mỗi file theo đúng **khung 10 mục** bên dưới. Thứ tự: **engine trong lát cắt 12 tuần trước**.
> Ngôn ngữ: tiếng Việt; code/identifier tiếng Anh. Types dùng chung: `@idtp/sdk` (doc 03).

## Khung 10 mục bắt buộc (§8)

| # | Mục |
|---|---|
| 1 | Mục đích & ranh giới trách nhiệm (**cái gì KHÔNG thuộc** engine này) |
| 2 | Interface công bố (TypeScript, đầy đủ chữ ký) |
| 3 | Mô hình dữ liệu nội bộ |
| 4 | Luồng xử lý (sequence diagram Mermaid) |
| 5 | Cấu hình (schema YAML/JSON + ví dụ) |
| 6 | Chỉ tiêu phi chức năng (số cụ thể) |
| 7 | Chế độ lỗi & phục hồi |
| 8 | Cách plugin mở rộng engine |
| 9 | Kế hoạch kiểm thử (unit/integration/load) |
| 10 | Quyết định thiết kế & phương án đã loại bỏ |

## Danh mục engine & thứ tự (slice‑first)

| File | Engine | Tầng | Trong lát cắt? | Trạng thái |
|---|---|---|---|---|
| `05-01-tag-realtime.md` | Tag/Realtime | L2 | ✔ | **Xong** |
| `05-02-graphics-runtime.md` | Graphics Runtime | L2 | ✔ | **Xong** |
| `05-03-alarm.md` | Alarm (ISA‑18.2) | L2 | ✔ | **Xong** |
| `05-04-historian-replay.md` | Historian + Replay | L2 | ✔ | **Xong** |
| `05-05-simulation.md` | Simulation host | L2 | ✔ | **Xong** |
| `05-06-control.md` | Control (PID/SFC) | L2 | ✔ | chờ |
| `05-07-security-rbac-audit.md` | Security/RBAC + Audit | L1/L2 | ✔ | chờ |
| `05-08-plugin-loader.md` | Plugin Loader/Factory | L1 | ✔ | chờ |
| `05-09-namespace-uns.md` | Namespace/UNS | L1 | ✔ | chờ |
| `05-10-asset-model.md` | Asset Model | L1 | ✔ | chờ |
| `05-11-data-contract-persistence.md` | Data Contract + Persistence | L1 | ✔ | chờ |
| `05-12-event-bus.md` | Event Bus | L1 | ✔ | chờ |
| `05-13-config-store.md` | Config Store | L1 | ✔ | chờ |
| `05-14-time-service.md` | Time Service | L1 | ✔ | chờ |
| `05-15-faceplate.md` | Faceplate | L2 | ✔ (cơ bản) | chờ |
| `05-16-navigation.md` | Navigation | L2 | ✔ | chờ |
| `05-17-report-kpi.md` | Report/KPI | L2 | v1 (template) | chờ |
| `05-18-maintenance.md` | Maintenance | L2 | v1‑complete | chờ |
| `05-19-ai-advisor.md` | AI Advisor | L2 | **v2** | chờ |

> Audit gộp trong `05-07` (Security/RBAC + Audit theo §4). Digital Twin Engine **không** có spec
> (đã xoá, doc 02 §4).
