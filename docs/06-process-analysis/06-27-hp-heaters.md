# 06‑27 — HP Heaters (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3 (3 HP heaters).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Gia nhiệt nước cấp bằng extraction steam cao áp trước economizer |
| 2 | Nguyên lý | **3 HP heaters** nối tiếp; extraction từ HP/IP turbine; cascade drain xuống DA; bypass khi sự cố |
| 3 | Thiết bị | 3 HP heaters, drain valves, bypass line + valve, relief |
| 4 | Instrument | Heater level, drain flow, FW in/out temp, extraction pressure |
| 5 | PLC/DCS | Feedwater heating control |
| 6 | Interlock/Trip | Heater level **HH → bypass** (chống water induction về turbine qua extraction); tube leak → isolate |
| 7 | Alarm | `FW-HPH1-LVL-HH` P1 (water induction) · drain valve fault P3 |
| 8 | Trend | heater level, FW out temp, drain flow |
| 9 | Faceplate | Heater level control + bypass status |
| 10 | Tag | `FW_HPH1_LEVEL_01` (mm) · `FW_HPH1_DRAIN_01` · `FW_HPH_FWOUT_TEMP_01` (°C) |
| 11 | Animation | Mức heater; bypass mở khi HH |
| 12 | Sequence | Vào heater string theo tải; bypass tự động khi level HH |
| 13 | SOP | Giám sát level (nguy cơ water induction turbine); kiểm tube leak |

**Định mức:** 3 HP heaters · FW ra ~283 °C tới economizer.
