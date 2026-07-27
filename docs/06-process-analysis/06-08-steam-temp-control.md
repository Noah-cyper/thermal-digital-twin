# 06‑08 — SH / RH Temp Control (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2 (SH 541 °C · RH out 3,8 MPa/541 °C, RH in 4,2 MPa/330 °C). C&E → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Giữ nhiệt độ hơi SH & RH ổn định **541 °C** trên dải tải |
| 2 | **Nguyên lý** | **Spray attemperator** (nước cấp) giữa tầng SH; RH temp bằng spray + tilt burner / gas recirculation; **cascade** temp control |
| 3 | **Thiết bị** | SH spray desuperheater, RH spray, spray control valves, burner tilt |
| 4 | **Instrument** | Temp trước & sau spray (SH/RH), spray flow, spray valve position |
| 5 | **PLC/DCS** | Steam temperature control (cascade) — Boiler Island |
| 6 | **Interlock/Trip** | **Block spray khi temp thấp** (chống water induction vào turbine); over‑temp protection |
| 7 | **Alarm** | `BLR-SH-TEMP-HH/LO` P1/P2 · `BLR-RH-TEMP-HH/LO` P1/P2 · spray valve fault P3 |
| 8 | **Trend** | SH/RH temp (trước‑sau spray), spray flow, valve position, MW |
| 9 | **Faceplate** | SH temp cascade (PV/SP/OP, MAN/AUTO/CASCADE) |
| 10 | **Tag** | `BLR_SH_TEMP_01` (°C, 541) · `BLR_RH_TEMP_01` (°C, 541) · `BLR_SH_SPRAY_CV_01` (%) · `BLR_RH_SPRAY_CV_01` (%) |
| 11 | **Animation** | Spray valve mở %; nhiệt độ hơi |
| 12 | **Sequence** | Temp control vào khi tải đủ; ramp SP nhiệt độ theo tải |
| 13 | **SOP** | Giữ 541 °C; **tránh spray quá tay** (water induction turbine); RH out 3,8 MPa/541 °C |

**Số vận hành định mức:** SH/RH out 541 °C · RH out 3,8 MPa · RH in 4,2 MPa/330 °C.
