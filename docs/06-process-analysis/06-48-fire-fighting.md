# 06‑48 — Fire Fighting (Balance of Plant)

> 13 mục §10.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Phát hiện & chữa cháy khu vực nguy cơ (transformer, cable, coal, turbine oil, H₂) |
| 2 | Nguyên lý | Fire water ring main (**jockey + main + diesel pump**), hydrant, **deluge/CO₂/foam** theo khu vực; detection nhiệt/khói/lửa |
| 3 | Thiết bị | Fire water pumps, ring main, deluge valves, CO₂/foam skid, detectors |
| 4 | Instrument | Fire water pressure, pump status, zone detection, deluge valve status |
| 5 | PLC/DCS | Fire alarm & suppression panel (thường độc lập, giám sát vào IDTP) |
| 6 | Interlock/Trip | Detection → alarm + deluge zone; **jockey giữ áp**, main/diesel start khi áp tụt; transformer fire → trip |
| 7 | Alarm | `FIRE-ALARM-ZONE-x` P1 · fire water pressure LO P1 · pump fail P2 |
| 8 | Trend | fire water pressure, pump run hours |
| 9 | Faceplate | Fire pump status + zone alarm |
| 10 | Tag | `FIRE_WATER_PRESS_01` (MPa) · `FIRE_ALARM_ZONE_01` (bool) · `FIRE_PUMP_MAIN_STATUS_01` |
| 11 | Animation | Zone cháy đỏ; pump chạy |
| 12 | Sequence | Jockey giữ áp → main → diesel theo áp tụt; deluge theo detection |
| 13 | SOP | Test pump định kỳ; xác nhận zone khi báo cháy; phối hợp trip thiết bị liên quan |
