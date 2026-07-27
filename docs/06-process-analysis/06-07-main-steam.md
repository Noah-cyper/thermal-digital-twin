# 06‑07 — Main Steam / Superheater (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2 (SH out 17,5 MPa(g)/541 °C). C&E → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Gia nhiệt hơi bão hoà → **hơi quá nhiệt** cấp cho HP turbine; dẫn hơi chính |
| 2 | **Nguyên lý** | SH nhiều tầng (radiant + convective) trong đường khói; hơi chính **17,5 MPa(g)/541 °C** tới HP turbine; áp điều khiển phối hợp boiler/turbine (CCS) |
| 3 | **Thiết bị** | SH platen/pendant/final, main steam piping, main steam stop valve (MSV), safety valves |
| 4 | **Instrument** | Main steam pressure/temp (SH out), steam flow, MSV position |
| 5 | **PLC/DCS** | Steam pressure control + coordinated control (CCS) |
| 6 | **Interlock/Trip** | Main steam pressure **HH → safety valve**; over‑pressure protection; SH out temp HH → giảm tải/spray |
| 7 | **Alarm** | `BLR-MSTM-PRESS-HH/LO` P1/P2 · `BLR-SH-TEMP-HH` P1 (hư ống) · MSV fault P2 |
| 8 | **Trend** | main steam pressure, SH out temp, steam flow, MW |
| 9 | **Faceplate** | Steam pressure control + MSV |
| 10 | **Tag** | `BLR_MSTM_SH_PRESS_01` (MPa, **KKS 10LAB10CP001** verified) · `BLR_MSTM_SH_TEMP_01` (°C, 541) · `BLR_STEAM_FLOW_01` (t/h) |
| 11 | **Animation** | Đường hơi chính (đỏ) chảy; áp/nhiệt độ cập nhật |
| 12 | **Sequence** | Warming main steam line khi khởi động; MSV mở khi đủ áp/nhiệt |
| 13 | **SOP** | Giữ 17,5 MPa/541 °C; tránh over‑temp ống SH; warming line tránh sốc nhiệt |

**Số vận hành định mức:** SH out 17,5 MPa(g)/541 °C · BMCR 2.008 t/h.
