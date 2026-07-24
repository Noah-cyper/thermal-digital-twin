# 06‑22 — Electrical Single Line (Electrical)

> 13 mục §10. Neo Design Basis §3.1/§3.3 (500 kV · GSU 20/500 kV 720 MVA · UAT 20/6,6 kV 2×50 MVA).

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Xuất tuyến 500 kV lên lưới + phân phối điện **tự dùng**; đóng cắt & bảo vệ |
| 2 | **Nguyên lý** | GSU 20/500 kV lên lưới; UAT 20/6,6 kV cấp tự dùng; 6,6 kV → 400 V MCC; auxiliary bus; diesel/UPS dự phòng |
| 3 | **Thiết bị** | GSU, UAT, 6,6 kV switchgear, 400 V MCC, breakers, busbar, station service transformer |
| 4 | **Instrument** | Bus voltage, feeder current, breaker status, P/Q, protection relay |
| 5 | **PLC/DCS** | Electrical Control System (ECS); protection relay IEC 61850 (v3) |
| 6 | **Interlock/Trip** | Bus protection; breaker interlock; **fast bus transfer** khi mất UAT → SAT; **diesel start khi blackout**; load shedding |
| 7 | **Alarm** | `ELEC-66KV-BUSA-UV` P1 · `ELEC-UAT-A-TEMP-HH` P2 · breaker trip P1 · earth fault P1 |
| 8 | **Trend** | bus voltage, feeder current, transformer temp |
| 9 | **Faceplate** | Breaker control (open/close + sync‑check + lý do interlock) |
| 10 | **Tag** | `ELEC_66KV_BUSA_VOLT_01` (kV) · `ELEC_UAT_A_TEMP_01` (°C) · `ELEC_GSU_TEMP_01` · `ELEC_BKR_66A_STATUS_01` (bool) |
| 11 | **Animation** | Single‑line breaker đóng/mở (màu); bus có/mất điện; dòng công suất |
| 12 | **Sequence** | **Fast bus transfer** khi mất UAT → SAT; diesel start on blackout; load shedding theo ưu tiên |
| 13 | **SOP** | Đóng cắt theo interlock + sync‑check; giám sát transformer temp; kiểm auto changeover |

**Số vận hành định mức:** lưới 500 kV/50 Hz · GSU 720 MVA · UAT 2×50 MVA · tự dùng ~7%.
