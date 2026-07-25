# 13 — Navigation Model (ISA‑101)

> Tài liệu #13/00–25 (§14). Engine: doc 05‑16. Màn hình: doc 12. Cây điều hướng **tách** cây thiết bị (doc 04).
> Plugin khai báo `nav/tree.yaml`, kernel render.

## 1. Cây điều hướng
```
D1 Plant Overview
├─ D2 Boiler Island ─ D3 Steam Drum / Pulverizer A–F / Fans / …  ─ D4 diag/faceplate
├─ D2 Turbine Island ─ D3 Turbine / Condenser / BFP / …
├─ D2 Generator / Electrical ─ D3 …
└─ D2 BoP (Coal/Ash/CW/Flue/…) ─ D3 …
S: Alarm · Trend · Historian · Report · Maintenance · Engineering · AI Advisor …
```
`nav/tree.yaml`: `{ screenId, level(D1–D4/S), title{vi,en}, parentId, hotkey }` (doc 05‑16).

## 2. Luật điều hướng (§7)
| Luật | Yêu cầu |
|---|---|
| Về D1 | ≤ 1 thao tác (phím tắt số 1) |
| D1 → D3 | ≤ 2 thao tác |
| Breadcrumb | mọi màn hình |
| Phím tắt số | D1=1, D2=2… (map hotkey) |
| Back/Forward | như trình duyệt (history stack) |
| Alarm ribbon click | → nhảy thẳng D3 chứa tag (index alarm→D3) |

## 3. Ánh xạ alarm → màn hình
`alarmId → tagId → asset_id → screen D3` (dựng index khi nạp plugin). Alarm không có D3 → về D2 area gần nhất.

## 4. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑23 | Gán hotkey số cụ thể cho D2/S — chốt khi dựng nav/tree.yaml thực |
