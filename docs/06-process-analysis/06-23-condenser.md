# 06‑23 — Condenser (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3 (vacuum 5,4 kPa(a) · CW 64.000 m³/h).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Ngưng hơi thoát LP → nước ngưng; tạo & giữ chân không |
| 2 | Nguyên lý | Shell‑tube, CW làm mát; **vacuum 5,4 kPa(a)**; hotwell chứa; vacuum pump/ejector khử khí không ngưng |
| 3 | Thiết bị | Condenser shell + tubes, hotwell, vacuum pump, LP bypass tie‑in |
| 4 | Instrument | Vacuum/pressure, hotwell level, CW in/out temp, condensate temp |
| 5 | PLC/DCS | Turbine Island / condenser control |
| 6 | Interlock/Trip | **Vacuum LO → turbine trip**; hotwell HH/LL |
| 7 | Alarm | `TRB-COND-VAC-LO` P1 · hotwell HH/LL P2 · CW out temp HH P3 |
| 8 | Trend | vacuum, hotwell level, CW in/out temp |
| 9 | Faceplate | Hotwell level control + vacuum |
| 10 | Tag | `TRB_COND_VACUUM_01` (kPa,5,4) · `TRB_COND_HOTWELL_LVL_01` (mm) · `TRB_CW_OUT_TEMP_01` (°C) |
| 11 | Animation | Mức hotwell; giá trị chân không |
| 12 | Sequence | Kéo chân không (vacuum pull) **trước khi roll turbine** |
| 13 | SOP | Giữ vacuum; kéo chân không trước roll; giám sát rò khí (air in‑leak) |

**Định mức:** vacuum 5,4 kPa(a) · CW 64.000 m³/h.
