# 06‑51 — UPS & Battery / DC System (Electrical / BoP)

> 13 mục §10. Neo Design Basis (DC 220 V / 110 V).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Cấp nguồn **DC 220 V/110 V** + **UPS AC** không gián đoạn cho điều khiển, bảo vệ, EOP, đóng cắt |
| 2 | Nguyên lý | Battery bank + charger (float/boost) → DC bus; inverter (UPS) cấp AC no‑break; DC 220 V (đóng cắt/EOP), 110 V (protection/control) |
| 3 | Thiết bị | Battery bank, charger 2×100%, inverter/UPS, DC distribution board |
| 4 | Instrument | DC bus voltage, battery voltage/current, charger status, UPS load, earth fault |
| 5 | PLC/DCS | DC/UPS monitoring vào IDTP |
| 6 | Interlock/Trip | Charger fail → battery discharge (giám sát dung lượng); **DC earth fault** → alarm; UPS bypass khi lỗi inverter |
| 7 | Alarm | `DC-220V-UV` P1 · charger fail P2 · **DC earth fault** P1 · battery temp HH P2 |
| 8 | Trend | DC bus voltage, battery current, UPS load |
| 9 | Faceplate | Charger/UPS status + DC bus |
| 10 | Tag | `DC_220V_VOLT_01` (V) · `DC_110V_VOLT_01` · `UPS_AC_STATUS_01` (enum) · `BATT_CHARGE_CURR_01` (A) |
| 11 | Animation | Charger/UPS/battery flow; earth fault đỏ |
| 12 | Sequence | Float charge; boost sau phóng; bypass UPS khi inverter lỗi |
| 13 | SOP | Giám sát dung lượng battery (blackout backup); xử lý DC earth fault ngay; test dung lượng định kỳ |

**Định mức:** DC 220 V (đóng cắt/EOP) · DC 110 V (protection/control).
