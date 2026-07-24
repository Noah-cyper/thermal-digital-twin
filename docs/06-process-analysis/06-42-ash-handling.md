# 06‑42 — Ash Handling (Balance of Plant)

> 13 mục §10. Neo Design Basis §3.1 (tro 15%).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Thải **tro đáy (bottom ash)** + **tro bay (fly ash)** khỏi lò/ESP |
| 2 | Nguyên lý | Bottom ash: submerged scraper/hopper → sluice; Fly ash: pneumatic từ ESP hopper → silo → xe |
| 3 | Thiết bị | Bottom ash hopper + scraper, clinker grinder, fly ash vessels, silo, blowers |
| 4 | Instrument | Hopper level, silo level, conveying pressure, scraper current |
| 5 | PLC/DCS | Ash Handling PLC (sequence) |
| 6 | Interlock/Trip | Hopper level HH → evacuate; silo level HH → dừng conveying; clinker grinder jam |
| 7 | Alarm | `ASH-BA-HOPPER-HH` P2 · `ASH-FLY-SILO-HH` P2 · grinder trip P3 |
| 8 | Trend | hopper/silo level, conveying pressure |
| 9 | Faceplate | Bottom/fly ash system status |
| 10 | Tag | `ASH_BOTTOM_LEVEL_01` (%) · `ASH_FLY_SILO_LEVEL_01` (%) · `ASH_CONV_PRESS_01` |
| 11 | Animation | Mức hopper/silo; conveying |
| 12 | Sequence | Bottom ash sluice định kỳ; fly ash conveying luân phiên hopper ESP |
| 13 | SOP | Xả hopper/silo đúng chu kỳ; tránh tắc; giám sát clinker |

**Định mức:** tro 15% (bottom + fly ash).
