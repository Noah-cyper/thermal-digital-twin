# 06‑31 — Turbine Bypass (Turbine Island)

> 13 mục §10. Neo Design Basis §3.2/§3.3. Dung lượng bypass cụ thể `[GIẢ ĐỊNH]` → doc 25.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Xả hơi vòng qua turbine khi khởi động/trip → bảo vệ boiler, match steam, giữ áp |
| 2 | Nguyên lý | **HP bypass** (SH out → cold reheat) + **LP bypass** (hot reheat → condenser) kèm spray giảm ôn |
| 3 | Thiết bị | HP bypass valve + spray, LP bypass valve + spray, condenser dump tube |
| 4 | Instrument | Bypass valve position, spray flow, downstream temp/pressure |
| 5 | PLC/DCS | Turbine bypass control |
| 6 | Interlock/Trip | Mở bypass khi **turbine trip / startup**; giới hạn dump vào condenser; block nếu vacuum thấp |
| 7 | Alarm | bypass valve fault P2 · downstream temp HH P2 · condenser dump limit P2 |
| 8 | Trend | bypass position, spray flow, main steam pressure |
| 9 | Faceplate | HP/LP bypass control |
| 10 | Tag | `BYP_HP_CV_01` (%) · `BYP_LP_CV_01` (%) · `BYP_HP_SPRAY_01` |
| 11 | Animation | Bypass valve mở %; đường hơi xả |
| 12 | Sequence | Startup: bypass giữ áp trước khi MSV mở; trip: bypass nhận hơi |
| 13 | SOP | Dùng bypass khi startup/trip; giám sát dump limit condenser; spray đủ giảm ôn |

**Định mức:** HP + LP bypass có spray giảm ôn.
