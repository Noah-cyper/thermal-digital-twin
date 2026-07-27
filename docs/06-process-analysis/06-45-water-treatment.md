# 06‑45 — Water Treatment / DM Plant (Balance of Plant)

> 13 mục §10.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Sản xuất **nước khử khoáng (demineralized)** bù tổn thất chu trình hơi‑nước |
| 2 | Nguyên lý | Pretreatment (lọc, khử cứng) → **RO / ion exchange** → DM water; giám sát conductivity & silica |
| 3 | Thiết bị | Multimedia filter, RO train, cation/anion/mixed‑bed, DM tank, regeneration (acid/caustic) |
| 4 | Instrument | Conductivity, silica, pH, tank level, flow |
| 5 | PLC/DCS | Water treatment PLC |
| 6 | Interlock/Trip | Conductivity/silica HH → chuyển regeneration; DM tank LL → dừng cấp |
| 7 | Alarm | `DM-CONDUCTIVITY-HH` P2 · silica HH P2 · DM tank LL P2 |
| 8 | Trend | conductivity, silica, tank level |
| 9 | Faceplate | DM train status + regeneration |
| 10 | Tag | `DM_CONDUCTIVITY_01` (µS/cm) · `DM_SILICA_01` (ppb) · `DM_TANK_LEVEL_01` (%) |
| 11 | Animation | Train chạy; mức tank; regeneration |
| 12 | Sequence | Service → regeneration (backwash, acid/caustic, rinse) tự động theo chất lượng |
| 13 | SOP | Giữ chất lượng DM (conductivity/silica); regeneration đúng chu kỳ |
