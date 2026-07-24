# 06‑09 — Boiler Protection / MFT (Boiler Island)

> 13 mục §10. NFPA 85 (BMS/FSSS). **Ma trận C&E MFT đầy đủ → doc 09** — ở đây liệt kê nguyên nhân + logic.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | **Master Fuel Trip (MFT)** cắt toàn bộ nhiên liệu khi nguy hiểm; FSSS/BMS giám sát an toàn buồng lửa |
| 2 | **Nguyên lý** | NFPA 85 BMS; tổng hợp nhiều nguyên nhân → MFT cắt tất cả mill/oil/igniter + trip; **first‑out annunciation** |
| 3 | **Thiết bị** | FSSS/BMS controller (tách khỏi control thường), trip relays, fuel trip valves, flame scanners |
| 4 | **Instrument** | Đọc từ các hệ: flame, furnace pressure, drum level, air flow, fan status, turbine trip |
| 5 | **PLC/DCS** | BMS/FSSS — hệ an toàn riêng |
| 6 | **Interlock/Trip (nguyên nhân MFT, §6.1 Phụ lục A)** | mất cả 2 ID · mất cả 2 FD · furnace pressure HH/LL · drum level HH/LL (±250) · **loss of all flame** · air flow < 25% BMCR · loss of all fuel · turbine trip (unit trip) · manual trip → **C&E đầy đủ doc 09** |
| 7 | **Alarm** | `BLR-MFT-TRIP` P1 · first‑out cause P1 · mỗi trip input P1/P2 |
| 8 | **Trend** | trạng thái trip input, MFT status |
| 9 | **Faceplate** | MFT status + **first‑out cause** + reset permissive |
| 10 | **Tag** | `BLR_MFT_STATUS_01` (bool) · `BLR_MFT_FIRSTOUT_01` (enum) · + các trip‑input tag |
| 11 | **Animation** | **Banner MFT đỏ** khi trip; hiển thị first‑out cause |
| 12 | **Sequence** | MFT → cắt fuel → **post‑MFT purge**; reset **chỉ khi** hết nguyên nhân + purge lại |
| 13 | **SOP** | Sau MFT xác định first‑out cause; purge lại trước light‑off; **không reset khi còn nguyên nhân** |

**Ghi chú:** đây là bản phân tích hệ; **cause & effect matrix MFT chi tiết** (nguyên nhân × hậu quả) nằm ở **doc 09**.
