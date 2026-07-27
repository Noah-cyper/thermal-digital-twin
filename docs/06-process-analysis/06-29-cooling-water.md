# 06‑29 — Cooling Water / CW (Cooling Water)

> 13 mục §10. Neo Design Basis §3.3 (64.000 m³/h · 2×CW pump 50%).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Cấp nước tuần hoàn làm mát condenser (thải nhiệt chu trình) |
| 2 | Nguyên lý | **2×50% CW pump**, lưu lượng **64.000 m³/h**; cooling tower → CW pump → condenser → tower |
| 3 | Thiết bị | CW pump 2×50%, travelling screen, butterfly valve, culvert |
| 4 | Instrument | CW flow, pump discharge pressure, supply/return temp, screen ΔP |
| 5 | PLC/DCS | Cooling water control |
| 6 | Interlock/Trip | **CW pump trip → vacuum degrade → turbine** (qua condenser); low flow; screen ΔP high |
| 7 | Alarm | `CW-PUMP-A-TRIP` P1 · low flow P2 · supply temp HH P3 · screen ΔP HH P3 |
| 8 | Trend | CW flow, supply/return temp, pump current |
| 9 | Faceplate | CW pump start/stop + valve |
| 10 | Tag | `CW_PUMP_A_FLOW_01` (m³/h) · `CW_SUPPLY_TEMP_01` (°C) · `CW_RETURN_TEMP_01` |
| 11 | Animation | Pump chạy; đường CW (xanh) chảy |
| 12 | Sequence | Start CW trước vacuum pull; standby transfer |
| 13 | SOP | Đủ CW trước kéo chân không; giám sát screen & nhiệt độ |

**Định mức:** 64.000 m³/h · 2×CW pump 50%.
