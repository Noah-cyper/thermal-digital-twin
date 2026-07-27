# 06‑03 — Pulverizer / Mill A–F (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2 (6 × 60 t/h, 5 chạy + 1 dự phòng). C&E → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Nghiền than thô → bột mịn, sấy bằng PA nóng, tải bột vào burner |
| 2 | **Nguyên lý** | Bowl mill + classifier; PA nóng vừa sấy vừa tải bột; seal air chặn rò; **6 × 60 t/h (5+1)** |
| 3 | **Thiết bị** | Mill, classifier, coal feeder, PA damper, seal air fan |
| 4 | **Instrument** | Mill outlet temp, ΔP mill, PA flow/temp, feeder speed, mill current |
| 5 | **PLC/DCS** | Mill control — Boiler Island |
| 6 | **Interlock/Trip** | Mill outlet temp **HH → trip**; **loss of seal air → trip**; feeder no coal → trip; **mill trip → runback + feeder off** (C&E doc 09) |
| 7 | **Alarm** | `MILL-A-OUTLET-TEMP-HH` P1 · `MILL-A-DP-HI` P2 · `MILL-A-PA-FLOW-LO` P2 · `MILL-A-FEEDER-TRIP` P1 (A…F) |
| 8 | **Trend** | mill outlet temp, PA flow, feeder speed, mill current |
| 9 | **Faceplate** | Mill start/stop + permissive + **lý do bị chặn** ("Start blocked: seal air low") |
| 10 | **Tag** | `MILL_A_OUTLET_TEMP_01` (°C) · `MILL_A_PA_FLOW_01` · `MILL_A_FEEDER_SPD_01` · `MILL_A_CURRENT_01` (A…F) |
| 11 | **Animation** | Mill quay khi chạy; feeder chạy; mill **đỏ khi trip** (vd Mill C trong kịch bản demo) |
| 12 | **Sequence** | Start: seal air → PA → mill → feeder; Stop: đảo lại; **Trip → runback** giữ tải bằng mill còn lại |
| 13 | **SOP** | Vào/cắt mill theo tải; mill trip → xác nhận runback; giữ outlet temp trong dải, tránh HH (nguy cơ cháy bột) |

**Số vận hành định mức:** 6 mill × 60 t/h (5 chạy + 1 dự phòng) · PA sấy nóng · than ẩm 10%.
