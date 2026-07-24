# 06‑40 — Stack & Flue Gas Path (Flue Gas)

> 13 mục §10. Neo Design Basis §3.2 (ống khói 210 m).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Dẫn & thải khói ra khí quyển qua ống khói **210 m** |
| 2 | Nguyên lý | Đường khói: Furnace → SH → RH → Economizer → Air Heater → ESP → ID Fan → (FGD) → Stack |
| 3 | Thiết bị | Ductwork, expansion joints, dampers, stack 210 m, CEMS platform |
| 4 | Instrument | Flue gas temp/flow tại các điểm, stack gas temp, damper position |
| 5 | PLC/DCS | Draft/combustion control (liên hệ ID fan) |
| 6 | Interlock/Trip | Damper interlock với fan/MFT; stack temp giám sát |
| 7 | Alarm | `STACK-GAS-TEMP-HH` P3 · duct ΔP high P3 |
| 8 | Trend | flue gas temp dọc đường, stack temp, flow |
| 9 | Faceplate | Damper + flue gas temp |
| 10 | Tag | `STACK_GAS_TEMP_01` (°C) · `STACK_GAS_FLOW_01` · `FLUE_ECON_OUT_TEMP_01` |
| 11 | Animation | Đường khói (nâu) chảy theo lưu lượng; damper |
| 12 | Sequence | Damper theo trình tự khởi động fan/purge |
| 13 | SOP | Giám sát nhiệt độ khói (acid dew point, hiệu suất); kiểm damper |

**Định mức:** ống khói 210 m.
