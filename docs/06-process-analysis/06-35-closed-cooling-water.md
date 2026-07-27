# 06‑35 — Closed Cooling Water / CCW (Balance of Plant)

> 13 mục §10.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Nước làm mát vòng kín cho thiết bị phụ (BFP, generator coolers, sample coolers, air compressors) |
| 2 | Nguyên lý | CCW pump tuần hoàn nước demineralized qua plate heat exchanger (làm mát bằng CW/raw water); vòng kín tránh cáu cặn |
| 3 | Thiết bị | CCW pump 2×100%, heat exchanger, head tank, chemical dosing |
| 4 | Instrument | CCW supply temp, flow, pressure, head tank level |
| 5 | PLC/DCS | BoP cooling control |
| 6 | Interlock/Trip | CCW pump trip → standby start; supply temp HH → cảnh báo thiết bị phụ |
| 7 | Alarm | `CCW-PUMP-A-TRIP` P2 · supply temp HH P2 · head tank LL P3 |
| 8 | Trend | CCW supply temp, flow |
| 9 | Faceplate | CCW pump + heat exchanger |
| 10 | Tag | `CCW_SUPPLY_TEMP_01` (°C) · `CCW_PUMP_A_FLOW_01` · `CCW_HEADTANK_LVL_01` |
| 11 | Animation | Pump chạy; nhiệt độ vòng kín |
| 12 | Sequence | Standby pump auto‑start; make‑up head tank |
| 13 | SOP | Giữ nhiệt độ cấp; kiểm chất lượng nước vòng kín |

**Định mức:** CCW 2×100% + heat exchanger.
