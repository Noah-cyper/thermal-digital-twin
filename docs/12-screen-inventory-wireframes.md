# 12 — Screen Inventory & Wireframes

> Tài liệu #12/00–25 (§14). Cây điều hướng ISA‑101 (§7). Layout & palette: doc 11. Nav rules: doc 13.
> Màn hình = **JSON khai báo** (`*.screen.json`), kernel render (doc 05‑02). **Chốt ≥ 70 màn hình.**

## 1. Phân cấp (ISA‑101) & số lượng
| Cấp | Nội dung | SL |
|---|---|---:|
| **D1** Plant Overview | toàn nhà máy, KPI, không chi tiết | 1 |
| **D2** Area Overview | theo khu vực | 21 |
| **D3** Equipment / Loop | thiết bị/loop chi tiết | ~52 |
| **D4** Diagnostic | faceplate mở rộng, I/O, network | theo thiết bị |
| **S** System | alarm/trend/report/… | 12 |
| **TỔNG (D1+D2+D3+S)** | | **~86 ≥ 70 ✓** |

## 2. Bản ghi màn hình (schema)
`screen_id · level · title{vi,en} · users · tags_shown[] · animations[] · alarms_shown[] ·
faceplate_links[] · nav_parent · hotkey`

Ví dụ (điền): `{ screen_id: D3-steam-drum, level: D3, title:{vi:"Bao hơi"}, users:[Operator],
tags_shown:[BLR_DRUM_LEVEL_01, BLR_FW_FLOW_01, BLR_STEAM_FLOW_01], faceplate_links:[PID-001-drum-level],
nav_parent: D2-boiler }`

## 3. Wireframe — D1 Plant Overview
```
┌ BANNER: UNIT1 · 598 MW · 50,0 Hz · 99,7% · P1:0 P2:2 P3:7 · Operator · 10:24 · ●LINK ┐
├NAV─┬────────────────────────────────────────────────────────────────────────────────┤
│ D1 │  [KPI: MW · Heat rate · Aux% · O₂ · Main steam MPa/°C · Vacuum]                  │
│ D2 │  [sơ đồ khối: Coal→Boiler→Turbine→Gen→Grid ; CW ; Flue→Stack]                    │
│ D3 │  [trạng thái tổng: mill 5/6 · fan · BFP · vacuum · alarm tổng]                   │
├────┴────────────────────────────────────────────────────────────────────────────────┤
│ ALARM RIBBON: 3 alarm mới nhất chưa ACK                                              │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Wireframe — D3 Steam Drum
```
┌ BANNER … ┐
├NAV┬───────────────────────────────────────────────────────────┤
│   │  [DRUM cylinder: cột nước + mức 0 mm, HH/LL ±250]           │
│   │  3-element: [FW flow] [steam flow] → [FCV-001 %]            │
│   │  áp bao hơi 18,9 MPa · click LT-001/FCV-001 → faceplate     │
├───┴───────────────────────────────────────────────────────────┤
│ ALARM: BLR-DRUM-LVL-HI …                                        │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Inventory — D2 Area (21)
Coal Handling · Boiler Island · Steam & Water Cycle · Turbine Island · Generator · Electrical ·
Cooling Water · Condenser · Feed Water · Fuel Oil · Ash Handling · Flue Gas · Air System ·
Water Treatment · Chemical Dosing · Instrument Air · Fire Fighting · HVAC · UPS/Battery ·
Diesel Generator · Emission (CEMS).

## 6. Inventory — D3 Equipment (~52, ánh xạ doc 06)
| Nhóm | Màn hình D3 |
|---|---|
| Boiler | Steam Drum · Drum Level 3‑element · Burner Management · Combustion/Furnace · Boiler Protection(MFT) · Steam Temp Control · Steam Pressure Control · Economizer · Air Heater A/B · Soot Blower |
| Mills/Fans | Pulverizer A–F (6) · Coal Feeder A–F (6) · FD Fan A/B · ID Fan A/B · PA Fan A/B |
| Turbine | Turbine Overview · Governor · Lube Oil · Gland Steam · Turbine Bypass · Condenser · Vacuum |
| Feed/Water | BFP A/B/MD (3) · CEP A/B · Deaerator · HP Heater 1‑3 · LP Heater 1‑4 · CCW |
| Cooling | CW Pump A/B · Cooling Tower |
| Elec/Gen | Generator · Excitation/AVR · Single Line · Switchyard Bay · UAT/GSU · Diesel Gen · UPS/DC |
| Flue/Ash | ESP A/B · Stack · CEMS · FGD · Ash Handling |
| BoP | Fuel Oil · Water Treatment · Chemical Dosing · Instrument Air · Fire · HVAC |

## 7. Inventory — S System (12)
Alarm Summary · Alarm History · Trend · Historian/Replay · Event Log · Report · KPI/Energy ·
Maintenance · Engineering · User Management · System Diagnostic · AI Advisor.

## 8. Luật (doc 13)
Về D1 ≤ 1 thao tác · D1→D3 ≤ 2 · breadcrumb mọi nơi · phím tắt số · back/forward · alarm click → D3.

## 9. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑22 | Số D3 ~52 (gộp/tách vài thiết bị) — chốt khi dựng screen.json thực; wireframe đầy đủ từng D3 ở pha thiết kế chi tiết |
