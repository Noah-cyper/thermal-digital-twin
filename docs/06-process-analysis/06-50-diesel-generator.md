# 06‑50 — Emergency Diesel Generator (Electrical / BoP)

> 13 mục §10.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Cấp điện khẩn cấp khi **blackout** (mất toàn bộ nguồn tự dùng) cho tải an toàn |
| 2 | Nguyên lý | EDG **auto‑start on bus undervoltage**, đóng vào emergency bus; cấp EOP, jacking oil, DC charger, emergency lighting; load sequencing |
| 3 | Thiết bị | Diesel engine + generator, fuel day tank, starting battery/air, emergency switchgear |
| 4 | Instrument | EDG voltage/frequency, engine speed, fuel level, coolant temp, breaker status |
| 5 | PLC/DCS | EDG control / emergency ECS |
| 6 | Interlock/Trip | **Auto‑start khi emergency bus undervoltage**; load sequencing (đóng tải theo bước); engine protection (overspeed, oil pressure) |
| 7 | Alarm | `EDG-FAIL-START` P1 · fuel level LO P2 · coolant temp HH P2 |
| 8 | Trend | EDG voltage, frequency, fuel level |
| 9 | Faceplate | EDG start/stop + breaker + load |
| 10 | Tag | `EDG_STATUS_01` (enum) · `EDG_BUS_VOLT_01` (V) · `EDG_FUEL_LEVEL_01` (%) |
| 11 | Animation | EDG chạy; emergency bus có điện; load sequencing |
| 12 | Sequence | Blackout → EDG start (≤ vài chục giây) → đóng bus → đóng tải theo ưu tiên |
| 13 | SOP | Test EDG định kỳ (auto‑start); giữ fuel day tank; kiểm load sequencing |
