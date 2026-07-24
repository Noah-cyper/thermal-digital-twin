# 06‑28 — LP Heaters (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3 (4 LP heaters).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Gia nhiệt nước ngưng bằng extraction LP trước deaerator |
| 2 | Nguyên lý | **4 LP heaters** nối tiếp trên đường condensate; extraction LP turbine; cascade drain |
| 3 | Thiết bị | 4 LP heaters, drain valves, bypass, relief |
| 4 | Instrument | Heater level, drain flow, condensate in/out temp |
| 5 | PLC/DCS | Feedwater heating control |
| 6 | Interlock/Trip | Heater level HH → bypass; tube leak → isolate |
| 7 | Alarm | `FW-LPH1-LVL-HH` P2 · drain fault P3 |
| 8 | Trend | heater level, condensate out temp, drain flow |
| 9 | Faceplate | Heater level + bypass |
| 10 | Tag | `FW_LPH1_LEVEL_01` (mm) · `FW_LPH1_DRAIN_01` · `FW_LPH_OUT_TEMP_01` (°C) |
| 11 | Animation | Mức heater; bypass |
| 12 | Sequence | Vào string theo tải; bypass khi level HH |
| 13 | SOP | Giám sát level & tube leak; cân bằng drain cascade |

**Định mức:** 4 LP heaters.
