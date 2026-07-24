# 06‑43 — Soot Blower (Boiler Island / BoP)

> 13 mục §10.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Thổi bồ hóng bám trên bề mặt trao đổi nhiệt (waterwall, SH, RH, econ, AH) giữ hiệu suất |
| 2 | Nguyên lý | Retractable/rotary soot blower dùng **hơi (aux steam)** hoặc air áp cao; thổi theo **sequence** vùng |
| 3 | Thiết bị | Wall blower, long retractable blower, air heater blower, steam supply valve |
| 4 | Instrument | Blowing steam pressure, blower position, sequence step |
| 5 | PLC/DCS | Soot blowing sequencer |
| 6 | Interlock/Trip | **Permissive**: đủ áp hơi thổi + tải ổn định; không thổi khi tải thấp/áp thấp; retract khi mất áp |
| 7 | Alarm | `SB-STEAM-PRESS-LO` P2 · blower stuck (không retract) P1 · sequence fault P3 |
| 8 | Trend | blowing steam pressure, sequence progress |
| 9 | Faceplate | Soot blow sequence start + step status |
| 10 | Tag | `SB_STEAM_PRESS_01` (MPa) · `SB_SEQ_STATUS_01` (enum) · `SB_BLOWER_POS_01` |
| 11 | Animation | Blower thò/thụt; sequence đang chạy |
| 12 | Sequence | Thổi tuần tự theo vùng; retract mỗi blower sau khi thổi |
| 13 | SOP | Thổi định kỳ khi tải đủ; đảm bảo retract (kẹt blower = hỏng ống); giám sát áp hơi |
