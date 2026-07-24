# 06‑47 — Compressed & Instrument Air (Balance of Plant)

> 13 mục §10.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Cấp **instrument air** (khô, sạch cho van điều khiển) + **service air** (dịch vụ) |
| 2 | Nguyên lý | Air compressor → after‑cooler → **dryer** → receiver; instrument air **ưu tiên** (mất IA → van về vị trí fail‑safe) |
| 3 | Thiết bị | Compressor 2×100%, dryer, receiver, IA/SA header, priority valve |
| 4 | Instrument | IA/SA header pressure, dew point, compressor status |
| 5 | PLC/DCS | Compressed air control |
| 6 | Interlock/Trip | **IA pressure LO → van fail‑safe**; SA cắt trước để giữ IA (priority valve); dryer dew point |
| 7 | Alarm | `IA-PRESS-LO` P1 (van mất khí) · dew point HH P2 · compressor trip P2 |
| 8 | Trend | IA/SA pressure, dew point |
| 9 | Faceplate | Compressor + header pressure |
| 10 | Tag | `IA_PRESS_01` (MPa) · `SA_PRESS_01` · `IA_DEWPOINT_01` (°C) |
| 11 | Animation | Compressor chạy/standby; áp header |
| 12 | Sequence | Standby compressor auto‑start; cắt SA giữ IA khi áp thấp |
| 13 | SOP | Ưu tiên IA tuyệt đối; giám sát dew point; kiểm priority valve |
