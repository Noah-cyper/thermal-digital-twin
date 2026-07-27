# 06‑20 — Turbine HP/IP/LP (Turbine Island)

> 13 mục §10. Neo Design Basis §3.3. **Turbine Trip Matrix → doc 09.**

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Biến enthalpy hơi → cơ năng quay generator; điều tốc & điều tải |
| 2 | **Nguyên lý** | **Tandem‑compound HP + IP + 2×LP, 3.000 rpm**, reheat, condensing; hơi chính → HP → reheat → IP → LP → condenser; quan hệ áp–lưu lượng theo **Stodola**; governor droop 4–5% |
| 3 | **Thiết bị** | HP/IP/LP casing, rotor, governor valves (GV), main stop valve, reheat stop/intercept valve, bearings, turning gear |
| 4 | **Instrument** | Speed, MW, GV position, bearing vib, bearing temp, axial displacement, differential expansion, lube oil pressure, condenser vacuum |
| 5 | **PLC/DCS** | Turbine governor / DEH + turbine protection |
| 6 | **Interlock/Trip (Turbine Trip Matrix §6.2)** | overspeed 110% · lube oil pressure LO · vacuum LO · bearing vib HH · axial displacement HH · bearing temp HH · generator protection trip · MFT · manual → **C&E doc 09** |
| 7 | **Alarm** | `TRB-BRG-VIB-HH` P1 · `TRB-BRG-TEMP-HH` P2 · `TRB-AXIAL-DISP-HH` P1 · `TRB-LUBE-OIL-PRESS-LO` P1 · `TRB-VACUUM-LO` P2 |
| 8 | **Trend** | speed, MW, bearing vib, lube oil pressure, vacuum, GV position |
| 9 | **Faceplate** | Turbine governor (speed/load), trip status + first‑out |
| 10 | **Tag** | `TRB_SPEED_01` (rpm, 3000) · `TRB_HP_BRG_VIB_02` (mm/s) · `TRB_LUBE_OIL_PRESS_01` (MPa) · `TRB_AXIAL_DISP_01` (mm) · `TRB_VACUUM_01` (kPa, 5,4) |
| 11 | **Animation** | Rotor quay; GV mở %; trip đỏ |
| 12 | **Sequence** | Turning gear → roll‑off → warming → **sync 3.000 rpm** → nhận tải; overspeed test |
| 13 | **SOP** | Warming trước roll; đủ vacuum trước roll; giám sát vib & differential expansion |

**Số vận hành định mức:** 3.000 rpm · chân không bình ngưng 5,4 kPa(a) · droop 4–5% · reheat.
