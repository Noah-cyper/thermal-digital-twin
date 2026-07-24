# 06‑46 — Chemical Dosing (Balance of Plant)

> 13 mục §10 (phosphate · hydrazine · ammonia).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Điều hoà hoá chất nước cấp/hơi chống ăn mòn & cáu cặn |
| 2 | Nguyên lý | **Phosphate** (drum, kiểm soát pH/độ cứng) · **Hydrazine** (khử O₂) · **Ammonia** (nâng pH condensate) — dosing pump định lượng |
| 3 | Thiết bị | Dosing tanks, metering pumps, mixers, injection quills |
| 4 | Instrument | pH, conductivity, dissolved O₂, phosphate residual, dosing flow |
| 5 | PLC/DCS | Chemical dosing control |
| 6 | Interlock/Trip | Dosing pump theo pH/O₂ feedback; tank LL → dừng dosing; overdose limit |
| 7 | Alarm | `CHEM-PH-LO/HI` P2 · dissolved O₂ HH P2 · dosing tank LL P3 |
| 8 | Trend | pH, dissolved O₂, phosphate residual |
| 9 | Faceplate | Dosing pump + setpoint |
| 10 | Tag | `CHEM_PH_01` · `CHEM_DO_01` (ppb) · `CHEM_PHOSPHATE_DOSE_01` |
| 11 | Animation | Dosing pump chạy; mức tank |
| 12 | Sequence | Dosing tự động theo feedback pH/O₂ |
| 13 | SOP | Giữ pH/O₂ trong dải; tránh overdose; theo dõi phosphate hideout khi đổi tải |
