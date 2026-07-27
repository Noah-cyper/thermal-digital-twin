# 06‑44 — Fuel Oil (Boiler Island / BoP)

> 13 mục §10. Khởi động & đỡ tải. Liên quan MFT (loss of all fuel → doc 09).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Cấp dầu (HFO/LDO) cho oil igniter/burner khi **khởi động** & **đỡ tải thấp** |
| 2 | Nguyên lý | Fuel oil pump + **heater** (giảm độ nhớt HFO), pressure control, **fuel oil trip valve**; light‑off theo NFPA 85 |
| 3 | Thiết bị | FO pump 2×100%, heater, strainer, trip valve, oil guns, igniter |
| 4 | Instrument | FO pressure/temp/flow, atomizing steam, valve position, flame scanner |
| 5 | PLC/DCS | BMS / oil burner control |
| 6 | Interlock/Trip | **Fuel oil trip valve đóng khi MFT**; oil pressure/temp ngoài dải → không cho light‑off; leak detection |
| 7 | Alarm | `FO-PRESS-LO` P2 · `FO-TEMP-LO` P2 (nhớt cao) · oil leak P1 · igniter fail P2 |
| 8 | Trend | FO pressure, temp, flow, atomizing steam |
| 9 | Faceplate | Oil burner/igniter control + permissive |
| 10 | Tag | `FO_PRESS_01` (MPa) · `FO_TEMP_01` (°C) · `FO_FLOW_01` · `FO_TRIPVLV_STATUS_01` |
| 11 | Animation | Oil gun in/out; igniter flame; trip valve |
| 12 | Sequence | Light‑off: purge → igniter → oil gun → ổn định → vào mill; MFT → đóng trip valve |
| 13 | SOP | Hâm dầu đủ nhiệt trước light‑off; kiểm rò dầu; tuân NFPA 85 |
