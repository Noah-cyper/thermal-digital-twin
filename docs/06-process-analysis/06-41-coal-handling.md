# 06‑41 — Coal Handling (Balance of Plant)

> 13 mục §10. Neo Design Basis §3.1 (than bituminous LHV 21.500 kJ/kg).

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Nhận, lưu, vận chuyển than tới bunker cấp cho mill |
| 2 | Nguyên lý | Coal yard → **stacker/reclaimer** → conveyor → **crusher** → bunker → feeder; conveyor sequence interlock |
| 3 | Thiết bị | Stacker/reclaimer, belt conveyors, crusher, magnetic separator, bunker, dust suppression |
| 4 | Instrument | Belt speed, belt load (weightometer), bunker level, motor current, belt drift |
| 5 | PLC/DCS | Coal Handling PLC (sequence) |
| 6 | Interlock/Trip | **Conveyor sequence interlock** (dừng thượng nguồn khi hạ nguồn dừng); belt trip; pull‑cord; fire/dust |
| 7 | Alarm | `COAL-CONV1-TRIP` P2 · bunker level LL P2 · belt drift P3 · fire P1 |
| 8 | Trend | belt load, bunker level, conveyor current |
| 9 | Faceplate | Conveyor start/stop + sequence status |
| 10 | Tag | `COAL_CONV1_SPEED_01` · `COAL_BUNKER_A_LEVEL_01` (%) · `COAL_CONV1_LOAD_01` (t/h) |
| 11 | Animation | Băng tải chạy; mức bunker; trip đỏ |
| 12 | Sequence | Start theo chiều **hạ→thượng nguồn**; stop ngược lại; trip → dừng chuỗi thượng nguồn |
| 13 | SOP | Giữ mức bunker; theo dõi belt drift/fire; sequence đúng chiều |

**Định mức:** than bituminous, LHV 21.500 kJ/kg, ẩm 10%, tro 15%.
