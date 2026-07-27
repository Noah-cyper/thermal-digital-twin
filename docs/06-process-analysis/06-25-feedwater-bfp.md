# 06‑25 — Feedwater / BFP (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3 (2×50% TDBFP + 1×30% MDBFP khởi động).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Bơm nước cấp áp cao vào drum qua HP heaters + economizer |
| 2 | Nguyên lý | **2×50% TDBFP** (turbine‑driven) + **1×30% MDBFP** (motor, khởi động); áp đẩy > drum 18,9 MPa; min‑flow recirc |
| 3 | Thiết bị | TDBFP×2, MDBFP, booster pump, feedwater CV, recirc valve |
| 4 | Instrument | BFP flow/discharge pressure/speed, suction pressure, feedwater flow, drum level |
| 5 | PLC/DCS | Feedwater control (3‑element) + BFP protection |
| 6 | Interlock/Trip | **Low suction → BFP trip**; **BFP trip → runback**; min‑flow recirc mở khi flow thấp |
| 7 | Alarm | `TRB-BFP-A-TRIP` P1 · low suction P1 · discharge press LO P2 · bearing vib HH P2 |
| 8 | Trend | BFP flow, speed, discharge pressure, drum level |
| 9 | Faceplate | BFP start/stop + speed control + permissive |
| 10 | Tag | `TRB_BFP_A_FLOW_01` · `TRB_BFP_A_SPEED_01` (rpm) · `TRB_FW_DISCH_PRESS_01` (MPa) |
| 11 | Animation | BFP chạy/standby; recirc valve; trip đỏ |
| 12 | Sequence | Khởi động **MDBFP** → chuyển sang **TDBFP** khi tải tăng; BFP trip → runback |
| 13 | SOP | Đủ suction & recirc trước start; theo dõi rung; BFP trip → xác nhận runback |

**Định mức:** 2×50% TDBFP + 1×30% MDBFP · nước cấp vào economizer 283 °C.
