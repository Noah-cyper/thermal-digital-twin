# 06‑26 — Deaerator (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3 (0,9 MPa/178 °C).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Khử O₂/khí hoà tan khỏi nước cấp + gia nhiệt + bể chứa nước cấp |
| 2 | Nguyên lý | Deaerating heater **0,9 MPa/178 °C**; extraction steam gia nhiệt; spray/tray tách khí; level control |
| 3 | Thiết bị | Deaerator + storage tank, spray/tray, pegging steam valve, level CV |
| 4 | Instrument | DA pressure/temp/level, extraction steam flow |
| 5 | PLC/DCS | Feedwater / deaerator control |
| 6 | Interlock/Trip | DA level **HH/LL**; pressure control (pegging steam khi tải thấp) |
| 7 | Alarm | `FW-DA-LVL-HH/LL` P2 · DA pressure LO P3 · O₂ dư cao P3 |
| 8 | Trend | DA level, pressure, temp |
| 9 | Faceplate | DA level & pressure control |
| 10 | Tag | `FW_DA_LEVEL_01` (mm) · `FW_DA_PRESS_01` (MPa,0,9) · `FW_DA_TEMP_01` (°C,178) |
| 11 | Animation | Mức bể DA; hơi pegging |
| 12 | Sequence | Pegging steam giữ áp khi tải thấp; nạp nước bù |
| 13 | SOP | Giữ 0,9 MPa/178 °C; kiểm O₂ dư; giữ mức storage |

**Định mức:** 0,9 MPa / 178 °C.
