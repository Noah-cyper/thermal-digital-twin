# 06‑30 — Cooling Tower (Cooling Water)

> 13 mục §10. Neo Design Basis §3.3 (natural draft hyperbolic 165 m).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Thải nhiệt nước tuần hoàn ra khí quyển (bay hơi) |
| 2 | Nguyên lý | **Natural draft hyperbolic 165 m**; nước nóng phun xuống fill, không khí đối lưu tự nhiên làm mát |
| 3 | Thiết bị | Tower shell 165 m, basin, distribution nozzles, fill, make‑up |
| 4 | Instrument | Basin level, outlet (cold) temp, make‑up flow, drift |
| 5 | PLC/DCS | Cooling water control |
| 6 | Interlock/Trip | Basin level LL → make‑up; approach temp cao → giảm tải `[GIẢ ĐỊNH]` |
| 7 | Alarm | `CT-BASIN-LVL-LL` P2 · cold water temp HH P3 |
| 8 | Trend | basin level, cold water temp, make‑up flow |
| 9 | Faceplate | Basin level + make‑up |
| 10 | Tag | `CT_BASIN_LEVEL_01` (mm) · `CT_OUT_TEMP_01` (°C) · `CT_MAKEUP_FLOW_01` |
| 11 | Animation | Mức basin; hơi nước bốc (tĩnh, không trang trí) |
| 12 | Sequence | Make‑up tự động theo mức basin |
| 13 | SOP | Giữ mức basin; giám sát chất lượng nước tuần hoàn (blowdown) |

**Định mức:** natural draft hyperbolic 165 m.
