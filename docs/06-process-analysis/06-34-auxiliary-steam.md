# 06‑34 — Auxiliary Steam (Balance of Plant)

> 13 mục §10. Nguồn/áp aux steam cụ thể `[GIẢ ĐỊNH]` → doc 25.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Cấp hơi phụ cho DA pegging, gland seal, fuel oil heating, soot blow khi khởi động/tải thấp |
| 2 | Nguyên lý | Aux steam header từ cold reheat/extraction (hoặc auxiliary boiler khi cold start) qua PRDS giảm áp‑ôn |
| 3 | Thiết bị | Aux steam header, PRDS station, auxiliary boiler `[GIẢ ĐỊNH]` |
| 4 | Instrument | Header pressure/temp, PRDS valve position |
| 5 | PLC/DCS | BoP steam control |
| 6 | Interlock/Trip | Header pressure LO → chuyển nguồn; PRDS temp control |
| 7 | Alarm | `AUX-STEAM-PRESS-LO` P2 · header temp HH P3 |
| 8 | Trend | header pressure/temp |
| 9 | Faceplate | Aux steam header control |
| 10 | Tag | `AUX_STEAM_PRESS_01` (MPa) · `AUX_STEAM_TEMP_01` (°C) |
| 11 | Animation | Áp header; PRDS valve |
| 12 | Sequence | Cold start dùng auxiliary boiler → chuyển sang extraction khi có tải |
| 13 | SOP | Giữ áp header; chuyển nguồn khi tải tăng |

**Định mức:** aux steam header + PRDS.
