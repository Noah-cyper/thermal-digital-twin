# 16 — Communication: UNS & MQTT Sparkplug B

> Tài liệu #16/00–25 (§14). Nguồn: Phụ lục A §10.5 + doc 04. Data bus v1 = MQTT Sparkplug B (Mosquitto).

## 1. Namespace Sparkplug B
```
spBv1.0/{group_id}/{message_type}/{edge_node_id}/{device_id}
```
| Thành phần | Giá trị |
|---|---|
| group_id | `PLANT1` |
| edge_node_id | `UNIT1_SIM` · `UNIT1_GW_OPCUA` (v3) · `UNIT1_GW_MODBUS` (v3) |
| device_id | `BOILER` · `TURBINE` · `GENERATOR` · `COAL` · `CW` · `ELEC` (ánh xạ cell → device: doc 04) |

## 2. Message types
`NBIRTH` `DBIRTH` `NDATA` `DDATA` `NDEATH` `DDEATH` `NCMD` `DCMD` `STATE`.
- BIRTH: công bố toàn bộ metric + alias.
- DATA: **report‑by‑exception** theo deadband, dùng alias (giảm băng thông).
- DEATH: last will → mất kết nối.

## 3. Payload (protobuf)
Có `seq` (0–255 cuộn vòng) · `bdSeq` (birth/death) · `alias` · timestamp · metric{name,value,quality}.
Tương ứng bản ghi tag (doc 04); `metric name = {device}/{fallback_name}` (doc 04 §5).

## 4. Topic ứng dụng (ngoài Sparkplug)
`plant1/unit1/alarm/{priority}` · `plant1/unit1/event` · `plant1/unit1/report/{type}`.

## 5. Ánh xạ UNS ↔ Sparkplug
`hoantran/haiphong/unit1/boiler/main-steam/pt-001/pv` ↔ `PLANT1/…/UNIT1_SIM/BOILER : BLR_MSTM_SH_PRESS_01`
↔ tag id nội bộ (doc 04 §5 — bảng 4 chiều).

## 6. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑26 | Phân bổ device_id chi tiết cho hệ BoP (ngoài 6 device chính) — chốt khi dựng gateway |
