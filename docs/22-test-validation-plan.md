# 22 — Test & Validation Plan

> Tài liệu #22/00–25 (§14). Nguồn: §9 (load) + Phụ lục A §11.3 (DoD).

## 1. Tầng kiểm thử
| Tầng | Phạm vi | Tiêu chí |
|---|---|---|
| **Unit** | logic sim, alarm state machine, PID, deadband, RBAC matrix | coverage ≥ 70% |
| **Integration** | sim→MQTT→tag→WS→HMI; write→audit; plugin load | luồng chính pass |
| **Load** | `apps/loadgen`: 50.000 tag/s, 20 client, 2 video wall | đạt bảng §9 (p95 sim→pixel < 500 ms) |
| **E2E** | Playwright: login, screen call‑up, ACK alarm, trend, replay | luồng chính xanh |
| **Guardrail** | AI ép ghi tag → từ chối; replay chặn lệnh | 100% chặn |

## 2. Kịch bản kiểu FAT
`Cold start → purge → light‑off → sync → ramp 0→600 MW → mill trip → runback → MFT → coast down`
— chạy trọn, alarm/trend/historian đúng; replay lại được.

## 3. Chỉ tiêu hiệu năng (nghiệm thu §9)
screen call‑up < 1 s · first paint < 2 s · 60 fps · ghi historian ≥ 50.000 điểm/s · truy vấn 24 h/8 tag < 2 s · seek < 2 s · nạp plugin < 10 s.

## 4. Definition of Done (mỗi sprint)
TS strict 0 lỗi · ESLint 0 warning · unit ≥ 70% · Playwright luồng chính · README module · cập nhật PROGRESS.

## 5. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑30 | Ngưỡng coverage 70% (có thể nâng theo module tới hạn: sim/alarm/PID) |
