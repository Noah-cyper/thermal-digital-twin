# 06‑32 — Gland / Seal Steam (Turbine Island)

> 13 mục §10. Áp/nhiệt seal steam cụ thể `[GIẢ ĐỊNH]` → doc 25.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Làm kín trục turbine, chống rò hơi ra ngoài & khí lọt vào chân không |
| 2 | Nguyên lý | Seal steam header cấp gland; **gland steam condenser (GSC)** thu hồi + duy trì áp header hơi thấp |
| 3 | Thiết bị | Seal steam header, gland seals, GSC + exhauster fan, control valve |
| 4 | Instrument | Header pressure, GSC pressure, seal steam temp |
| 5 | PLC/DCS | Turbine auxiliary control |
| 6 | Interlock/Trip | Header pressure LO → bổ sung auxiliary steam; LO trước khi kéo chân không |
| 7 | Alarm | `GLD-STEAM-PRESS-LO` P2 · GSC exhauster trip P3 |
| 8 | Trend | header pressure, GSC pressure |
| 9 | Faceplate | Seal steam header pressure control |
| 10 | Tag | `GLD_STEAM_PRESS_01` (kPa) · `GLD_GSC_PRESS_01` |
| 11 | Animation | Áp header; exhauster chạy |
| 12 | Sequence | Cấp seal steam **trước khi kéo chân không**; chuyển self‑sealing khi có tải |
| 13 | SOP | Đảm bảo seal steam trước vacuum; giám sát rò gland |

**Định mức:** seal steam header + GSC.
