# 06‑24 — Condensate System / CEP (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3 (CEP 2×100%, 1 chạy/1 dự phòng).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Bơm nước ngưng từ hotwell qua LP heaters → deaerator; giữ mức hotwell |
| 2 | Nguyên lý | **2×100% CEP** (1 run/1 standby); hotwell level control bằng CV/recirc; condensate polishing |
| 3 | Thiết bị | CEP 2×100%, condensate polishing, recirc valve, LP heater string |
| 4 | Instrument | CEP flow/discharge pressure, hotwell level, condensate flow |
| 5 | PLC/DCS | Turbine Island |
| 6 | Interlock/Trip | Hotwell **LL → CEP trip** (bảo vệ); low suction; standby auto‑start khi pump chạy trip |
| 7 | Alarm | `TRB-CEP-TRIP` P1 · hotwell LL P2 · discharge press LO P2 |
| 8 | Trend | CEP flow, discharge pressure, hotwell level |
| 9 | Faceplate | CEP start/stop + hotwell level |
| 10 | Tag | `TRB_CEP_A_FLOW_01` · `TRB_CEP_DISCH_PRESS_01` (MPa) · `TRB_COND_HOTWELL_LVL_01` |
| 11 | Animation | Pump chạy (xanh)/standby; mức hotwell |
| 12 | Sequence | CEP start theo mức hotwell; **auto standby start** khi pump chạy trip |
| 13 | SOP | Giữ mức hotwell; kiểm chuyển đổi tự động standby; polishing khi cần |

**Định mức:** CEP 2×100%.
