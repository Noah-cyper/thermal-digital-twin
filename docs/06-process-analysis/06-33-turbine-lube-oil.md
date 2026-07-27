# 06‑33 — Turbine Lube Oil (Turbine Island)

> 13 mục §10. Liên quan Turbine Trip (§6.2 → doc 09).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Bôi trơn & làm mát ổ trục turbine/generator; jacking oil; control oil |
| 2 | Nguyên lý | Main oil pump (shaft‑driven) + **AOP** (aux, AC) + **EOP** (emergency, DC); oil coolers; jacking oil khi turning gear |
| 3 | Thiết bị | MOP/AOP/EOP, oil tank, coolers, filters, jacking oil pump |
| 4 | Instrument | Lube oil pressure/temp, tank level, bearing oil flow |
| 5 | PLC/DCS | Turbine auxiliary + protection |
| 6 | Interlock/Trip | **Lube oil pressure LO → turbine trip**; **EOP auto‑start** khi pressure LO; jacking oil trước turning gear |
| 7 | Alarm | `TRB-LUBE-OIL-PRESS-LO` P1 · oil temp HH P2 · tank level LO P2 |
| 8 | Trend | lube oil pressure, temp, tank level |
| 9 | Faceplate | Oil pump control (MOP/AOP/EOP) |
| 10 | Tag | `TRB_LUBE_OIL_PRESS_01` (MPa) · `TRB_LUBE_OIL_TEMP_01` (°C) · `TRB_OIL_TANK_LVL_01` |
| 11 | Animation | Pump chạy; áp/nhiệt dầu; EOP đỏ khi khởi động khẩn |
| 12 | Sequence | AOP chạy khi startup/shutdown; EOP dự phòng DC; jacking oil khi turning |
| 13 | SOP | Đảm bảo lube oil trước roll; kiểm EOP (DC) định kỳ; giám sát áp/nhiệt |

**Định mức:** MOP + AOP(AC) + EOP(DC).
