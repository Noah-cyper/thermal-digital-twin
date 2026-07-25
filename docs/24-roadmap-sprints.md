# 24 — Roadmap & Sprints

> Tài liệu #24/00–25 (§14). Nguồn: doc 00 §8 (lát cắt) + Phụ lục A §11.3. Lát cắt 12 tuần = chứng minh kiến trúc.

## 1. Lát cắt v1 — 12 tuần (4 pha)
| Pha | Tuần | Sprint | DoD |
|---|---|---|---|
| **A** Nền + skeleton | W1–4 | monorepo/CI · kernel + Plugin Loader · walking skeleton (sim→MQTT→WS→SVG) | giá trị realtime trên browser, trễ < 500 ms |
| **B** Sim + đồ hoạ | W5–7 | sim Boiler Island + PID · Graphics Runtime đọc screen.json (8–10 màn hình) | ramp dải hẹp không dao động, call‑up < 1 s |
| **C** Alarm + lịch sử + bảo mật | W8–10 | Alarm ISA‑18.2 · Historian + DATA REPLAY · RBAC 6 vai | ACK/shelve audit, seek < 2 s |
| **D** Generic + đóng gói | W11–12 | **plugin #2** · loadgen/benchmark · OTS cơ bản · e2e | thêm plugin #2 = 0 dòng sửa kernel/apps |

**6 tiêu chí kết thúc lát cắt:** doc 00 §8.

## 2. Sau lát cắt → v1‑complete (breadth)
Mở rộng 41 hệ → đủ code · 3.000 tag → seed · 70 màn hình → screen.json · 600 alarm · 25 loop · kịch bản full. Ước lượng: ~2,5–3 năm solo+AI (doc 00 §4).

## 3. v2 / v3
- **v2**: Engineering L5 (screen/tag builder) · AI advisor thật (RAG) · Re‑simulation what‑if · mobile.
- **v3**: driver OPC UA/Modbus/61850 thật · redundancy · multi‑site · ML predictive.

## 4. Giả định
Tham chiếu GĐ‑01/02/03 (ước lượng công sức).
