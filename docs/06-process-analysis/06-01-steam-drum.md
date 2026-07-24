# 06‑01 — Steam Drum (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2. Tag theo doc 04. C&E MFT → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Tách hỗn hợp hơi–nước, ổn định mức, cấp hơi bão hoà cho superheater; đệm khối lượng nước/hơi |
| 2 | **Nguyên lý** | Tuần hoàn tự nhiên: downcomer → waterwall (riser) → drum; tách hơi bằng cyclone + scrubber; điều khiển **mức 3‑element** (level + steam flow + feedwater flow) |
| 3 | **Thiết bị** | Drum (18,9 MPa), cyclone separators, downcomers, risers, feedwater CV |
| 4 | **Instrument** | LT × 3 (đo mức, chọn median), PT áp bao hơi, TT nhiệt độ; FT feedwater, FT steam |
| 5 | **PLC/DCS** | Boiler control (Drum Level Control) — thuộc Boiler Island |
| 6 | **Interlock/Trip** | Drum level **HH +250 / LL −250 mm → MFT**; áp bao hơi HH → safety valve (C&E doc 09) |
| 7 | **Alarm** | `BLR-DRUM-LVL-HH` +250 P1 · `-HI` +50 P2 · `-LO` −50 P2 · `-LL` −250 P1 · áp bao hơi HH P2 |
| 8 | **Trend** | drum level, drum pressure, feedwater flow, steam flow (so lệch 3‑element) |
| 9 | **Faceplate** | `PID-001-drum-level` (PV/SP/OP, 3‑element, MAN/AUTO/CASCADE) |
| 10 | **Tag** | `BLR_DRUM_LEVEL_01` (mm, −400…400, db5) · `BLR_DRUM_PRESS_01` (MPa) · `BLR_FW_FLOW_01` (t/h) · `BLR_STEAM_FLOW_01` (t/h) |
| 11 | **Animation** | Cột nước dâng/hạ trong drum; đổi màu viền theo alarm (HH/LL đỏ) |
| 12 | **Sequence** | Fill khi khởi động (MDBFP → mức normal); chuyển 1‑element→3‑element khi tải > ~20% |
| 13 | **SOP** | Giữ mức 0 ± 50 mm; xử lý **swell/shrink** khi đổi tải nhanh (không phản ứng ngược quá mức); kiểm 3 LT lệch nhau |

**Số vận hành định mức:** áp bao hơi 18,9 MPa · mức normal 0 ± 50 mm · trip ± 250 mm · feedwater vào economizer 283 °C · BMCR 2.008 t/h.
