# 06 — Phân tích công nghệ nhà máy nhiệt điện than 600 MW (plugin `thermal-power-600`)

> **Nguồn chuẩn:** `annex-A-thermal-design-basis.md` §3 (Design Basis) — *lấy nguyên số, không đổi*.
> Mọi số ngoài §3 gắn `[GIẢ ĐỊNH]` và đăng ký ở `docs/25-assumptions-open-issues.md`.
> Tài liệu này phân tích **45 hệ thống × 13 mục** (đạt nghiệm thu §10 ≥ 40 hệ). Tag/alarm/màn hình/model
> nêu trong tài liệu **ánh xạ tới hiện thực đã dựng** (registry `thermalSeedSpec` 3.610 tag / 662 alarm /
> 87 màn hình; 12 mô hình sim; 8 SFC; 2 ma trận C&E) — nhất quán registry đã chốt (doc 04/07/08/09).

## 0. Khung 13 mục (theo prompt cha §doc 06)

Mỗi hệ thống xuất đủ 13 mục: **Chức năng · Nguyên lý · Thiết bị · Instrument · PLC/DCS · Interlock/Trip ·
Alarm · Trend · Faceplate · Tag · Animation · Sequence · SOP.**

Quy ước tham chiếu:
- **Tag** dùng mã đã hiện thực (`BLR_*`, `TRB_*`, `GEN_*`, `FW_*`, `COND_*`, `CT_*`, `FG_*`, `EMI_*`,
  `ELEC_*`, `COAL_*`, `PLANT_*`) khi có mô hình sim; hệ breadth dùng KKS `<unit><sys><nn><mã><seq>`
  (cấu trúc `[GIẢ ĐỊNH]` chờ đối chiếu VGB-B 106 — GĐ-04, hạng mục mở M-02).
- **DCS phân hệ** theo thông lệ: CCS (Coordinated Control), BMS (Burner Management, NFPA 85),
  SCS (Sequence Control), TG (Turbine-Generator control), ECS (Electrical Control), BOP.
- **Model** = mô hình sim đã hiện thực trong `plugins/thermal-power-600/src/sim/`.

## 1. Danh mục hệ thống (45 hệ)

| # | Hệ thống | Vùng KKS | Model / màn hình liên quan |
|---|---|---|---|
| A. Cung cấp than & nhiên liệu | | | |
| 6.1 | Coal Yard & Stacker/Reclaimer | coal | CoalHandlingModel · D3-coal-handling |
| 6.2 | Coal Conveyor & Crusher | coal | CoalHandlingModel |
| 6.3 | Coal Bunker & Feeder | coal | CoalHandlingModel |
| 6.4 | Pulverizer / Mill (6×60 t/h) | coal | CoalHandlingModel · BoilerIslandModel |
| 6.5 | Fuel Oil (khởi động & đỡ tải) | fuel-oil | (breadth) |
| B. Lò hơi | | | |
| 6.6 | Furnace & Burner | boiler | BoilerIslandModel · FlueGasAirModel |
| 6.7 | Steam Drum & Circulation | boiler | BoilerIslandModel/DrumModel |
| 6.8 | Superheater (SH) | boiler | BoilerIslandModel |
| 6.9 | Reheater (RH) | boiler | ReheatCycleModel |
| 6.10 | Economizer | boiler | FeedwaterTrainModel |
| 6.11 | Drum Level / Feedwater Control | boiler | BoilerIslandModel (loop drum-level) |
| 6.12 | SH/RH Attemperator (spray) | boiler | BoilerIslandModel (loop sh-temp) |
| 6.13 | Soot Blower | boiler | (breadth) |
| 6.14 | Ash Handling (bottom + fly) | ash | EmissionsModel (fly ash) |
| C. Gió & khói | | | |
| 6.15 | FD Fan (2×50%) | air | BoilerIslandModel (loop air-o2-trim) |
| 6.16 | ID Fan (2×50%) | flue-gas | BoilerIslandModel (loop furnace-draft) |
| 6.17 | PA Fan (2×50%) | air | (breadth) |
| 6.18 | Air Heater (Ljungström 2×) | flue-gas | FlueGasAirModel |
| 6.19 | ESP (2×4 trường) | flue-gas | EmissionsModel |
| 6.20 | FGD (khử SO₂) | flue-gas | EmissionsModel |
| 6.21 | CEMS + Ống khói 210 m | flue-gas | EmissionsModel · D3-emissions-cems |
| D. Turbine & van hơi | | | |
| 6.22 | HP Turbine | turbine | TurbineGeneratorModel · ReheatCycleModel |
| 6.23 | IP/LP Turbine (2×LP) | turbine | ReheatCycleModel |
| 6.24 | Turbine Governor & Steam Valves | turbine | BoilerIslandModel (governor) · C&E turbine-trip |
| 6.25 | Turbine Lube Oil & Gland Steam | turbine | (breadth) |
| 6.26 | Turbine Bypass (HP/LP) | turbine | (breadth) |
| E. Bình ngưng & nước tuần hoàn | | | |
| 6.27 | Condenser | cw | CondenserCWModel · D3-condenser-cw |
| 6.28 | Condensate System | cw | FeedwaterTrainModel |
| 6.29 | Circulating Water (CW pump) | cw | CondenserCWModel |
| 6.30 | Cooling Tower + Vacuum System | cw | CoolingTowerModel · D3-cooling-tower |
| F. Nước cấp & gia nhiệt | | | |
| 6.31 | LP Heaters (4×) | boiler | FeedwaterTrainModel |
| 6.32 | Deaerator | boiler | FeedwaterTrainModel |
| 6.33 | Boiler Feed Pump (BFP) | boiler | FeedwaterTrainModel |
| 6.34 | HP Heaters (3×) | boiler | FeedwaterTrainModel · D3-feedwater-heatrate |
| G. Điện | | | |
| 6.35 | Generator (667 MVA) | generator | TurbineGeneratorModel · ElectricalModel |
| 6.36 | Excitation / AVR | generator | ElectricalModel |
| 6.37 | GSU + UAT Transformers | electrical | ElectricalModel · D3-electrical |
| 6.38 | Switchyard 500 kV | switchyard | (breadth) |
| 6.39 | Emergency Diesel Generator | diesel | (breadth) |
| 6.40 | UPS & Battery (DC 220/110 V) | ups | (breadth) |
| H. Hoá & phụ trợ | | | |
| 6.41 | Water Treatment (DM plant) | wtp | (breadth) |
| 6.42 | Chemical Dosing | dosing | (breadth) |
| 6.43 | Compressed & Instrument Air | air | (breadth) |
| 6.44 | Fire Fighting | fire | (breadth) |
| 6.45 | HVAC | hvac | (breadth) |

---

# A. CUNG CẤP THAN & NHIÊN LIỆU

## 6.1 Coal Yard & Stacker/Reclaimer (KKS coal)
- **Chức năng:** Dự trữ than (~26 ngày [GIẢ ĐỊNH]), đánh đống (stacker) và bốc lấy (reclaimer) cấp cho tuyến băng tải.
- **Nguyên lý:** Than về bằng đường sắt/băng, stacker rải theo lớp chống tự cháy; reclaimer gạt than lên băng tải theo nhu cầu bunker. Trộn để đồng đều nhiệt trị.
- **Thiết bị:** Stacker, reclaimer (bucket-wheel), băng tải yard, cân băng, phun nước dập bụi.
- **Instrument:** Cảm biến vị trí stacker/reclaimer, cân băng (belt weigher), báo mức đống, đo bụi, camera nhiệt phát hiện điểm nóng.
- **PLC/DCS:** SCS (Sequence Control) cụm coal handling, liên động với CCS qua nhu cầu bunker.
- **Interlock/Trip:** Băng tải xuống dừng → dừng băng trên (cascade); phát hiện điểm nóng → phun nước + báo; quá tải motor → trip.
- **Alarm:** Mức đống thấp (dự trữ < 7 ngày, P2), điểm nóng tự cháy (P1), lệch băng, quá tải reclaimer.
- **Trend:** `COAL_YARD_DAYS_01`, tốc độ reclaim (t/h), nhiệt độ đống.
- **Faceplate:** Reclaimer (chạy/dừng, dòng, tốc độ), stacker vị trí.
- **Tag:** `COAL_YARD_DAYS_01` (dự trữ, ngày) [hiện thực]; breadth: `10EU10*` (stacker/reclaimer status/dòng/vị trí).
- **Animation:** Reclaimer quay bucket-wheel, than chảy trên băng (màu than `#8B7355`).
- **Sequence:** SCS "yard-to-bunker" — khởi động ngược chiều dòng: bunker feeder ← băng nạp ← reclaimer.
- **SOP:** Kiểm tra đống chống tự cháy hằng ca; luân phiên FIFO; dừng reclaim khi bunker đầy (>90%).

## 6.2 Coal Conveyor & Crusher (KKS coal)
- **Chức năng:** Vận chuyển than từ yard, nghiền sơ bộ (crusher) xuống cỡ hạt cấp bunker.
- **Nguyên lý:** Băng tải nhiều đoạn nối tiếp; crusher (ring/hammer) giảm cỡ hạt < 25 mm [GIẢ ĐỊNH]; tách kim loại (magnetic separator) trước crusher.
- **Thiết bị:** Băng tải (2 tuyến), crusher, magnetic separator, chuyển hướng (tripper/diverter).
- **Instrument:** Cảm biến tốc độ băng, lệch băng (belt sway), rách băng (rip detector), dòng motor crusher, kim loại phát hiện.
- **PLC/DCS:** SCS coal handling.
- **Interlock/Trip:** Dừng cascade ngược dòng khi đoạn dưới dừng; kim loại phát hiện → dừng + báo; rách/lệch băng → trip.
- **Alarm:** Lệch băng (P2), rách băng (P1), nghẽn crusher (dòng cao), tắc phễu.
- **Trend:** `COAL_CONVEYOR_FEED_01`, dòng crusher, tốc độ băng.
- **Faceplate:** Crusher (chạy/dừng, dòng), băng tải (chạy/dừng, tốc độ).
- **Tag:** `COAL_CONVEYOR_FEED_01` (t/h) [hiện thực]; breadth: `10EU2x*` (băng tải/crusher).
- **Animation:** Băng tải chạy (dòng than), crusher quay.
- **Sequence:** SCS khởi động băng tải ngược chiều dòng, dừng cùng chiều dòng (làm sạch băng).
- **SOP:** Khởi động chuỗi băng tải trước khi cấp than; dừng chạy rỗng 2 phút để làm sạch.

## 6.3 Coal Bunker & Feeder (KKS coal)
- **Chức năng:** Chứa than trung gian (~8 h ở tải danh định [GIẢ ĐỊNH]) và định lượng cấp cho mill qua feeder trọng lượng.
- **Nguyên lý:** Bunker = kho đệm; băng tải cấp theo trễ (hysteresis 60/90% [GIẢ ĐỊNH]); gravimetric feeder cân định lượng than xuống mill theo lệnh CCS.
- **Thiết bị:** Bunker (2.400 t [GIẢ ĐỊNH]), 6 gravimetric feeder, cửa chặn (gate), rung chống nghẽn.
- **Instrument:** Đo mức bunker (radar/plumb), cân feeder, tốc độ feeder, báo tắc.
- **PLC/DCS:** CCS (lệnh feeder theo fuel demand) + SCS (điều khiển băng tải cấp bunker).
- **Interlock/Trip:** Bunker rỗng → trip feeder + báo mill; tắc feeder → dừng + báo; mill trip → dừng feeder tương ứng.
- **Alarm:** Mức bunker thấp (<30%, P2), rỗng (P1), feeder tắc, lệch cân feeder.
- **Trend:** `COAL_BUNKER_LEVEL_01`, `COAL_FEEDER_RATE_01`, `COAL_CONSUMPTION_01`.
- **Faceplate:** Feeder (chạy/dừng, suất t/h, mill đích), bunker (mức %).
- **Tag:** `COAL_BUNKER_LEVEL_01` (%), `COAL_FEEDER_RATE_01` (t/h), `COAL_CONVEYOR_FEED_01` (t/h) [hiện thực].
- **Animation:** Mức than trong bunker (bargraph), feeder chạy, than rơi xuống mill.
- **Sequence:** SFC `mill-a-start` (permissive gồm bunker đủ than) — xem doc 09.
- **SOP:** Giữ bunker 60–90%; kiểm hiệu chuẩn cân feeder định kỳ; xả than ẩm/vón.

## 6.4 Pulverizer / Mill (6 × 60 t/h) (KKS coal)
- **Chức năng:** Nghiền than thành bột mịn (< 75 µm ~70% [GIẢ ĐỊNH]), sấy bằng gió nóng PA, thổi bột than tới burner.
- **Nguyên lý:** Bowl/roller mill nghiền + phân ly (classifier); gió PA nóng sấy & tải bột than; 5 mill chạy + 1 dự phòng ở tải danh định (BMCR ~283 t/h than → 5 mill × ~57 t/h).
- **Thiết bị:** 6 mill (bowl), classifier, PA damper vào mill, seal air, lube oil mill.
- **Instrument:** Nhiệt gió ra mill (outlet temp), chênh áp mill (ΔP), dòng motor mill, lưu lượng PA, mức bi/lô.
- **PLC/DCS:** CCS (fuel demand → mill loading) + BMS (mill trip logic, NFPA 85).
- **Interlock/Trip:** Nhiệt gió ra > 90 °C [GIẢ ĐỊNH] → trip (chống cháy bột than); mất PA → trip; mất lửa burner nhóm → trip mill; mill trip → runback CCS.
- **Alarm:** Nhiệt gió ra mill cao (P1 cháy), ΔP mill cao (nghẽn), dòng motor cao, mất seal air.
- **Trend:** `COAL_MILL_LOADING_01`, `COAL_MILLS_RUNNING_01`, nhiệt gió ra, ΔP mill.
- **Faceplate:** Mill A–F (chạy/dừng, tải %, nhiệt ra, dòng, mode).
- **Tag:** `COAL_MILL_LOADING_01` (%), `COAL_MILLS_RUNNING_01` (số máy), `BLR_COAL_FLOW_01` (t/h tổng), `BLR_MILL_A_STOP_CMD` [hiện thực].
- **Animation:** Mill quay, bột than thổi lên burner; mill dừng → xám.
- **Sequence:** SFC `mill-a-start` / `mill-a-stop` (doc 09) — nối vào sim (GĐ-49: `BLR_MILL_A_STOP_CMD` bớt công suất).
- **SOP:** Khởi động mill: chạy PA sấy → mở feeder → tăng tải; mill trip là nguyên nhân runback (giảm tải tự động).

## 6.5 Fuel Oil — khởi động & đỡ tải (KKS fuel-oil)
- **Chức năng:** Cấp dầu (HFO/LDO) cho igniter/warm-up burner khi khởi động lạnh và đỡ tải thấp (< 30% [GIẢ ĐỊNH]) khi lửa than chưa ổn định.
- **Nguyên lý:** Bơm dầu áp cao → van chặn/điều tiết → oil gun tại burner; hâm dầu (HFO) tới độ nhớt phun; igniter điện đánh lửa mồi.
- **Thiết bị:** Bơm dầu (2×), bồn dầu, bộ hâm, oil gun + igniter mỗi burner, van trip nhanh (SSV).
- **Instrument:** Áp dầu, nhiệt/độ nhớt dầu, giám sát lửa igniter (flame scanner), vị trí van.
- **PLC/DCS:** BMS (đánh lửa, trip theo NFPA 85).
- **Interlock/Trip:** Không có lửa scanner trong thời gian trial-for-ignition → đóng van dầu (SSV); áp dầu thấp → trip; MFT → đóng toàn bộ oil SSV.
- **Alarm:** Áp dầu thấp (P1), mất lửa igniter (P1), nhiệt dầu thấp (độ nhớt cao), rò dầu.
- **Trend:** Áp/nhiệt dầu, số oil gun đang chạy, lưu lượng dầu.
- **Faceplate:** Oil gun (in/out, lửa OK), bơm dầu (chạy/dừng, áp).
- **Tag:** breadth `10EG*` (áp/nhiệt/van dầu, flame scanner). [GIẢ ĐỊNH cấu trúc KKS]
- **Animation:** Oil gun in/out, ngọn lửa igniter nhấp nháy khi đánh lửa.
- **Sequence:** SFC `light-off` (doc 09): purge xong → đưa oil gun + igniter → xác nhận lửa → tăng dầu.
- **SOP:** Trial-for-ignition ≤ 10 s [GIẢ ĐỊNH]; rút oil gun khi lửa than ổn định > 30% tải.

---

# B. LÒ HƠI

## 6.6 Furnace & Burner (KKS boiler)
- **Chức năng:** Đốt bột than sinh nhiệt bức xạ cho vách lò (waterwall) sinh hơi; buồng lửa cân bằng áp (balanced draft).
- **Nguyên lý:** Bột than + gió cấp 2 (secondary air) cháy trong buồng lửa; nhiệt bức xạ → waterwall bay hơi; O₂ ra economizer giữ 3,2% (điều gió theo tải + trim O₂).
- **Thiết bị:** Waterwall, burner nhiều tầng (tangential/wall-fired), windbox, buồng lửa, ống góp.
- **Instrument:** Áp buồng lửa (−50 Pa, dải −200…+200), O₂ ra economizer (3,2%), flame scanner từng burner, nhiệt vách, CO.
- **PLC/DCS:** CCS (boiler master, air/fuel/O₂) + BMS (flame, MFT).
- **Interlock/Trip:** MFT khi mất toàn bộ lửa, áp buồng lửa HH/LL, gió < 25% BMCR, mất cả 2 ID/FD fan (xem §Deep-dive MFT).
- **Alarm:** Áp buồng lửa cao/thấp (P1), O₂ thấp (cháy thiếu, P1), mất lửa (P1), nhiệt vách cao.
- **Trend:** `BLR_FURN_PRESS_01` (breadth), `BLR_FLUE_O2_01`, `BLR_STEAM_FLOW_01`, `BLR_MSTM_SH_TEMP_01`.
- **Faceplate:** Boiler master (firing demand, O₂, áp lò), burner (lửa OK/out).
- **Tag:** `BLR_FLUE_O2_01` (%), `BLR_STEAM_FLOW_01` (t/h), `BLR_FIRING_DEMAND`, `BLR_MFT_TRIP`, `BLR_MILLS_TRIP` [hiện thực].
- **Animation:** Ngọn lửa buồng lửa (cường độ theo firing demand), đổi đỏ khi nhiệt cao.
- **Sequence:** SFC `boiler-purge` → `light-off` (NFPA 85, doc 09); MFT cắt toàn bộ nhiên liệu (GĐ-48).
- **SOP:** Purge ≥ 5 phút (5 lần thể tích lò) [GIẢ ĐỊNH] trước light-off; giữ O₂ 3–3,5%; theo dõi CO chống cháy không hoàn toàn.

## 6.7 Steam Drum & Circulation (KKS boiler)
- **Chức năng:** Tách hơi–nước (bao hơi), duy trì mức nước, cấp nước tuần hoàn tự nhiên xuống waterwall.
- **Nguyên lý:** Nước từ economizer vào drum; hỗn hợp hơi–nước từ riser vào drum, cyclone/scrubber tách hơi khô lên SH, nước xuống downcomer → waterwall (tuần hoàn tự nhiên do chênh mật độ).
- **Thiết bị:** Bao hơi (drum), cyclone separator, downcomer, riser, van xả đáy (blowdown), safety valve.
- **Instrument:** Mức drum (3 phép đo bù áp/nhiệt), áp drum (18,9 MPa), nhiệt bão hoà, độ dẫn nước (chemistry).
- **PLC/DCS:** CCS (điều khiển mức 3-element: mức + lưu lượng hơi + lưu lượng nước cấp).
- **Interlock/Trip:** Mức drum HH/LL (±250 mm) → MFT; áp drum cao → safety valve xả.
- **Alarm:** Mức drum cao/thấp (±150 mm P2, ±250 mm P1), áp drum cao, độ dẫn cao (chemistry).
- **Trend:** `BLR_DRUM_LEVEL_01`, `BLR_DRUM_PRESS_01` (breadth), lưu lượng hơi vs nước cấp.
- **Faceplate:** Drum level (PV/SP/OP loop 3-element, mode).
- **Tag:** `BLR_DRUM_LEVEL_01` (mm), `BLR_FW_CV_01` (van nước cấp), `BLR_FW_FILL_CMD` [hiện thực].
- **Animation:** Mức nước trong drum (dâng/hạ), hơi bốc lên SH.
- **Sequence:** SFC `feedwater-fill` (doc 09, GĐ-49: `BLR_FW_FILL_CMD` bơm điền lò 300 t/h).
- **SOP:** Điền lò tới mức khởi động trước light-off; giữ mức 0 ± 50 mm; blowdown theo chemistry.

## 6.8 Superheater (SH) (KKS boiler)
- **Chức năng:** Quá nhiệt hơi bão hoà từ drum lên 17,5 MPa/541 °C (hơi chính) cấp HP turbine.
- **Nguyên lý:** Hơi khô từ drum qua các dàn SH (bức xạ + đối lưu) nhận nhiệt khói; nhiệt độ điều bằng spray attemperator (§6.12).
- **Thiết bị:** Dàn SH sơ cấp/thứ cấp/cuối, ống góp, van an toàn SH.
- **Instrument:** Nhiệt hơi chính SH out (541 °C), áp SH out (17,5 MPa), nhiệt vách ống SH.
- **PLC/DCS:** CCS (SH temp loop → spray).
- **Interlock/Trip:** Nhiệt vách SH cao → cảnh báo/giảm tải; áp SH cao → van an toàn.
- **Alarm:** Nhiệt hơi chính cao/thấp (P2 tại ±10 °C), nhiệt vách SH cao (P1 quá nhiệt kim loại).
- **Trend:** `BLR_MSTM_SH_TEMP_01`, `BLR_MSTM_SH_PRESS_01`, độ mở spray.
- **Faceplate:** SH temp (PV/SP, spray OP), áp hơi chính.
- **Tag:** `BLR_MSTM_SH_TEMP_01` (°C), `BLR_MSTM_SH_PRESS_01` (MPa), `BLR_SH_SPRAY_CV_01` [hiện thực].
- **Animation:** Hơi chảy qua dàn SH; ống đổi màu khi nhiệt vách cao.
- **Sequence:** —(vận hành liên tục; khởi động theo ramp nhiệt cùng lò).
- **SOP:** Kiểm soát tốc độ tăng nhiệt SH khi khởi động (chống sốc nhiệt kim loại); giữ 541 ± 5 °C.

## 6.9 Reheater (RH) (KKS boiler)
- **Chức năng:** Tái nhiệt hơi thoát HP turbine (cold reheat 4,2 MPa/330 °C) lên hot reheat 3,8 MPa/541 °C cấp IP turbine.
- **Nguyên lý:** Hơi thoát HP về reheater trong đường khói, nhận nhiệt đối lưu; điều nhiệt bằng damper khói/spray RH; nâng hiệu suất chu trình.
- **Thiết bị:** Dàn RH, ống góp cold/hot reheat, spray RH, van bypass.
- **Instrument:** Nhiệt/áp cold reheat (RH in), nhiệt/áp hot reheat (RH out 541 °C), nhiệt vách RH.
- **PLC/DCS:** CCS (RH temp loop → gas damper/spray).
- **Interlock/Trip:** Mất lưu lượng hơi RH khi lò còn cháy → nguy cơ cháy ống RH → giảm nhiệt; nhiệt vách RH cao → cảnh báo.
- **Alarm:** Nhiệt hot reheat thấp (< 500 °C P2 — GĐ-65), nhiệt vách RH cao (P1), áp RH cao.
- **Trend:** `TRB_HRH_TEMP_01`, `TRB_CRH_TEMP_01`, `TRB_HRH_PRESS_01`, `TRB_REHEAT_DUTY_01`.
- **Faceplate:** RH temp (hot/cold), reheat duty.
- **Tag:** `TRB_CRH_PRESS_01`, `TRB_CRH_TEMP_01`, `TRB_HRH_PRESS_01`, `TRB_HRH_TEMP_01`, `TRB_REHEAT_DUTY_01` [hiện thực — ReheatCycleModel, GĐ-65].
- **Animation:** Hơi cold reheat → RH → hot reheat (màu tái nhiệt `#E8791E`).
- **Sequence:** — (khởi động cùng turbine roll; đảm bảo lưu lượng hơi RH trước khi tăng nhiệt).
- **SOP:** Đảm bảo bypass RH/turbine cấp lưu lượng hơi trước khi tăng lửa (chống cháy khô ống RH).

## 6.10 Economizer (KKS boiler)
- **Chức năng:** Tận dụng nhiệt khói cuối lò hâm nước cấp lên 283 °C trước khi vào drum → tăng hiệu suất lò.
- **Nguyên lý:** Nước cấp từ HP heater qua dàn economizer (đối lưu) trong đường khói sau RH, nhận nhiệt khói còn lại; O₂ đo tại đây (3,2%).
- **Thiết bị:** Dàn economizer, ống góp, van recirculation (chống sôi khi khởi động).
- **Instrument:** Nhiệt nước ra economizer (283 °C), nhiệt khói ra economizer, lưu lượng nước cấp.
- **PLC/DCS:** CCS (nằm trong vòng nước cấp/khói).
- **Interlock/Trip:** Không lưu lượng nước cấp khi lò cháy → nguy cơ sôi economizer → mở recirc/giảm lửa.
- **Alarm:** Nhiệt nước ra economizer thấp (hiệu suất kém), nhiệt khói ra cao (bám bẩn ống).
- **Trend:** `FW_ECON_INLET_TEMP_01`, nhiệt khói ra economizer, `BLR_FLUE_O2_01`.
- **Faceplate:** Economizer (nhiệt nước ra, nhiệt khói).
- **Tag:** `FW_ECON_INLET_TEMP_01` (°C) [hiện thực — FeedwaterTrainModel]; breadth nhiệt khói.
- **Animation:** Nước cấp chảy qua economizer (màu nước cấp `#2E6FD9`), khói ngang.
- **Sequence:** — (mở recirc khi khởi động, đóng khi có lưu lượng nước cấp ổn định).
- **SOP:** Mở đường recirculation economizer khi khởi động lạnh; theo dõi nhiệt khói ra chỉ báo bám bẩn.

## 6.11 Drum Level / Feedwater Control (3-element) (KKS boiler)
- **Chức năng:** Duy trì mức drum bằng điều khiển 3-phần tử: mức drum + lưu lượng hơi + lưu lượng nước cấp.
- **Nguyên lý:** Feedforward lưu lượng hơi + feedback mức drum → setpoint lưu lượng nước cấp → van/bơm nước cấp; chống "shrink & swell" khi thay đổi tải.
- **Thiết bị:** Van điều tiết nước cấp (FCV), BFP (§6.33), đo lưu lượng.
- **Instrument:** Mức drum (3 phép), lưu lượng hơi, lưu lượng nước cấp, độ mở FCV.
- **PLC/DCS:** CCS — loop `drum-level` (cascade: master mức → slave lưu lượng nước cấp).
- **Interlock/Trip:** Mức drum ±250 mm → MFT; mất nước cấp → runback/trip.
- **Alarm:** Lệch mức (P2/P1), lệch lưu lượng hơi–nước cấp (mismatch).
- **Trend:** `BLR_DRUM_LEVEL_01`, `BLR_STEAM_FLOW_01`, `BLR_FW_CV_01`.
- **Faceplate:** Drum level loop (PV/SP/OP, MAN/AUTO/CASCADE).
- **Tag:** `BLR_DRUM_LEVEL_01`, `BLR_FW_CV_01`, `BLR_STEAM_FLOW_01` [hiện thực — loop CCS live].
- **Animation:** Mức drum + độ mở van nước cấp.
- **Sequence:** Chuyển MAN→AUTO→CASCADE khi lưu lượng đủ tin cậy (thường > 30% tải).
- **SOP:** Khởi động ở MAN (single-element mức); chuyển 3-element khi tải > 30%; giữ 0 ± 50 mm.

## 6.12 SH/RH Attemperator — Spray (KKS boiler)
- **Chức năng:** Điều nhiệt hơi quá nhiệt/tái nhiệt bằng phun nước ngưng (spray) làm mát giữa các dàn.
- **Nguyên lý:** Nước cấp/ngưng phun vào dòng hơi qua desuperheater; loop nhiệt SH out → van spray; giữ 541 °C không vượt giới hạn kim loại.
- **Thiết bị:** Desuperheater (spray nozzle), van spray SH/RH, đường nước ngưng.
- **Instrument:** Nhiệt hơi trước/sau spray, độ mở van spray, lưu lượng spray.
- **PLC/DCS:** CCS — loop `sh-temp` (cascade nhiệt).
- **Interlock/Trip:** Van spray mở quá → nguy cơ nước lỏng vào turbine → giới hạn + báo; nhiệt sau spray thấp bất thường → đóng.
- **Alarm:** Nhiệt hơi chính cao (spray bão hoà), van spray full open, nhiệt sau spray thấp (nước cuốn).
- **Trend:** `BLR_MSTM_SH_TEMP_01`, `BLR_SH_SPRAY_CV_01`, lưu lượng spray.
- **Faceplate:** SH spray loop (PV/SP/OP).
- **Tag:** `BLR_SH_SPRAY_CV_01`, `BLR_MSTM_SH_TEMP_01` [hiện thực].
- **Animation:** Van spray (độ mở), tia nước phun vào hơi.
- **Sequence:** — (liên tục; kích hoạt khi nhiệt SH vượt SP).
- **SOP:** Ưu tiên điều nhiệt bằng gió/burner tilt; spray là điều tinh; tránh full-open kéo dài (nguy cơ nước vào turbine).

## 6.13 Soot Blower (KKS boiler)
- **Chức năng:** Thổi bồ hóng/tro bám trên bề mặt trao đổi nhiệt (SH/RH/economizer/air heater) bằng hơi/gió nén, duy trì hiệu suất truyền nhiệt.
- **Nguyên lý:** Chuỗi soot blower (retractable/rotary) thổi theo trình tự định kỳ; dùng hơi trích hoặc gió nén; theo dõi nhiệt khói để đánh giá bám bẩn.
- **Thiết bị:** Soot blower (nhiều vị trí), van hơi thổi, bộ truyền động rút/quay.
- **Instrument:** Vị trí soot blower, áp hơi thổi, nhiệt khói (chỉ báo bám bẩn).
- **PLC/DCS:** SCS (trình tự thổi tự động).
- **Interlock/Trip:** Áp hơi thổi thấp → dừng (chống hư ống); soot blower kẹt → rút khẩn cấp.
- **Alarm:** Áp hơi thổi thấp, soot blower kẹt, nhiệt khói cao (bám bẩn nặng).
- **Trend:** Nhiệt khói từng vùng, chu kỳ thổi, áp hơi thổi.
- **Faceplate:** Soot blower sequence (đang thổi vị trí nào), áp hơi.
- **Tag:** breadth `10HS*` (vị trí/áp/van soot blower). [GIẢ ĐỊNH KKS]
- **Animation:** Soot blower rút ra/vào, tia hơi thổi.
- **Sequence:** SCS chuỗi thổi tuần tự theo lịch/khi nhiệt khói tăng ngưỡng.
- **SOP:** Thổi theo ca hoặc khi chênh nhiệt khói vượt ngưỡng; không thổi khi tải quá thấp (chống dập lửa).

## 6.14 Ash Handling — bottom + fly ash (KKS ash)
- **Chức năng:** Thu gom, vận chuyển tro đáy (bottom ash) và tro bay (fly ash từ ESP) ra bãi thải/silo.
- **Nguyên lý:** Tro đáy rơi xuống bể/submerged conveyor; tro bay từ phễu ESP/economizer hút chân không/khí nén về silo; xả ẩm chống bụi.
- **Thiết bị:** Submerged scraper conveyor (bottom ash), pneumatic conveying (fly ash), silo, van xả.
- **Instrument:** Mức silo tro bay, mức bể tro đáy, áp chân không tuyến khí nén, nhiệt tro đáy.
- **PLC/DCS:** SCS ash handling.
- **Interlock/Trip:** Silo đầy → dừng conveying + báo; kẹt conveyor tro đáy → dừng; mất khí nén → dừng fly ash.
- **Alarm:** Silo tro đầy (P2), kẹt conveyor, nhiệt tro đáy cao.
- **Trend:** Mức silo, lưu lượng tro (suy từ than × tro 15%), `EMI_DUST_STACK_01` (tro thoát).
- **Faceplate:** Silo (mức), conveyor tro đáy (chạy/dừng).
- **Tag:** breadth `10HN*` (mức silo/conveyor); liên quan `EMI_ESP_EFF_01`, tro = than×0,15.
- **Animation:** Tro rơi vào bể, conveyor gạt, silo (mức).
- **Sequence:** SCS xả tro định kỳ + vận chuyển về silo.
- **SOP:** Xả tro đáy theo ca; vận chuyển tro bay khi phễu ESP đầy; kiểm mức silo trước xe lấy tro.

---

# C. GIÓ & KHÓI

## 6.15 FD Fan — Forced Draft (2×50%) (KKS air)
- **Chức năng:** Cấp gió cháy (secondary air) vào windbox qua air heater; điều lưu lượng gió theo nhu cầu cháy + trim O₂.
- **Nguyên lý:** 2 quạt ly tâm/hướng trục 50%; điều lưu lượng bằng inlet vane/blade pitch; phối hợp ID fan giữ áp buồng lửa cân bằng.
- **Thiết bị:** 2 FD fan, inlet vane/damper, motor.
- **Instrument:** Lưu lượng gió cấp 2, độ mở vane, dòng motor, áp gió windbox.
- **PLC/DCS:** CCS — loop `air-o2-trim` (gió theo firing + O₂ trim).
- **Interlock/Trip:** Mất cả 2 FD fan → MFT; 1 FD trip → runback (giảm tải); vane kẹt → báo.
- **Alarm:** Lưu lượng gió thấp (< 25% BMCR → MFT), dòng motor cao, rung quạt.
- **Trend:** `BLR_FD_DAMPER_01`, lưu lượng gió cấp 2, O₂.
- **Faceplate:** FD fan (chạy/dừng, vane %, dòng), air/O₂ loop.
- **Tag:** `BLR_FD_DAMPER_01`, `BLR_FLUE_O2_01` [hiện thực]; breadth lưu lượng/dòng FD.
- **Animation:** Quạt FD quay, gió cấp 2 (màu `#93B8D8`) vào windbox.
- **Sequence:** SFC `boiler-purge` khởi động FD sau ID; NFPA 85 thứ tự ID→FD→PA.
- **SOP:** Khởi động FD sau ID (giữ áp âm); giữ O₂ 3,2%; 1 fan trip → runback tự động.

## 6.16 ID Fan — Induced Draft (2×50%) (KKS flue-gas)
- **Chức năng:** Hút khói ra khỏi buồng lửa qua ESP/FGD tới ống khói; duy trì áp buồng lửa −50 Pa (balanced draft).
- **Nguyên lý:** 2 quạt hút 50%; điều lưu lượng bằng vane; loop `furnace-draft` giữ áp buồng lửa; là quạt khởi động đầu tiên (tạo áp âm trước khi cấp gió/nhiên liệu).
- **Thiết bị:** 2 ID fan, inlet vane, motor (thường lớn nhất nhà máy).
- **Instrument:** Áp buồng lửa (−50 Pa), độ mở vane ID, dòng motor, rung.
- **PLC/DCS:** CCS — loop `furnace-draft`.
- **Interlock/Trip:** Mất cả 2 ID fan → MFT; áp buồng lửa HH/LL → MFT; 1 ID trip → runback.
- **Alarm:** Áp buồng lửa cao/thấp (P1), rung ID cao, dòng motor cao.
- **Trend:** `BLR_ID_VANE_01`, `BLR_FURN_PRESS_01` (breadth), dòng ID.
- **Faceplate:** ID fan (chạy/dừng, vane %, dòng), furnace draft loop.
- **Tag:** `BLR_ID_VANE_01` [hiện thực]; breadth áp buồng lửa/dòng ID.
- **Animation:** Quạt ID quay, khói (màu `#8B7355`) hút ra.
- **Sequence:** SFC `boiler-purge`: ID khởi động ĐẦU TIÊN → tạo áp âm → purge 5 phút.
- **SOP:** Luôn khởi động ID trước FD; giữ áp lò −50 Pa; ID trip → runback/MFT tuỳ mức độ.

## 6.17 PA Fan — Primary Air (2×50%) (KKS air)
- **Chức năng:** Cấp gió sơ cấp nóng sấy & tải bột than từ mill tới burner.
- **Nguyên lý:** 2 quạt PA 50%; gió qua air heater nóng lên; áp PA đủ thắng trở lực mill + đường bột than; nhiệt gió PA điều bằng cold-air damper (tempering).
- **Thiết bị:** 2 PA fan, air heater PA side, tempering damper, đường gió tới 6 mill.
- **Instrument:** Áp PA, nhiệt gió PA (sau tempering), lưu lượng PA tới từng mill.
- **PLC/DCS:** CCS/SCS (áp PA header + nhiệt gió mill).
- **Interlock/Trip:** Mất PA → trip mill; nhiệt gió PA cao → tempering (chống cháy bột than trong mill).
- **Alarm:** Áp PA thấp (trip mill), nhiệt gió PA cao (P1 cháy mill), lưu lượng PA mill thấp.
- **Trend:** Áp PA header, nhiệt gió PA, lưu lượng PA/mill.
- **Faceplate:** PA fan (chạy/dừng, áp), nhiệt gió mill.
- **Tag:** breadth `10HL*` (áp/nhiệt/lưu lượng PA). [GIẢ ĐỊNH KKS]
- **Animation:** Quạt PA quay, gió nóng vào mill.
- **Sequence:** Khởi động PA trước khi cấp than vào mill (sấy); NFPA thứ tự ...→PA→mill.
- **SOP:** Chạy PA sấy mill trước khi mở feeder; giữ nhiệt gió PA dưới ngưỡng cháy.

## 6.18 Air Heater — Ljungström 2× (KKS flue-gas)
- **Chức năng:** Thu hồi nhiệt khói ra economizer (~350 °C) hâm gió cháy (FD + PA) → giảm tổn thất khói khô, tăng hiệu suất lò.
- **Nguyên lý:** Rotor gốm quay (regenerative) luân phiên nhận nhiệt khói rồi nhả cho gió; khói ra ~130 °C tới ESP; độ hữu hiệu ~0,84 [GIẢ ĐỊNH].
- **Thiết bị:** 2 air heater Ljungström (rotor + motor quay), seal, thổi bụi.
- **Instrument:** Nhiệt khói vào/ra AH, nhiệt gió vào/ra AH, dòng motor rotor, chênh áp AH.
- **PLC/DCS:** BOP/CCS (giám sát; rotor chạy liên tục).
- **Interlock/Trip:** Rotor dừng (mất truyền động) → nguy cơ cháy AH → báo + giảm tải; chênh áp cao (bám bẩn).
- **Alarm:** Rotor AH dừng (P1), nhiệt khói ra AH cao (hiệu suất kém), chênh áp cao, chênh nhiệt điểm sương (ăn mòn).
- **Trend:** `FG_AH_GAS_IN_TEMP_01`, `FG_STACK_TEMP_01`, `AH_AIR_OUT_TEMP_01`, `FG_DRYGAS_LOSS_01`.
- **Faceplate:** Air heater (nhiệt vào/ra khói+gió, rotor chạy/dừng).
- **Tag:** `FG_AH_GAS_IN_TEMP_01`, `FG_STACK_TEMP_01`, `AH_AIR_OUT_TEMP_01`, `FG_DRYGAS_LOSS_01` [hiện thực — FlueGasAirModel, GĐ-68].
- **Animation:** Rotor AH quay, khói/gió trao đổi.
- **Sequence:** — (chạy liên tục; khởi động rotor trước khi có khói nóng).
- **SOP:** Luôn chạy rotor trước light-off; thổi bụi AH định kỳ; theo dõi điểm sương chống ăn mòn nguội.

## 6.19 ESP — Electrostatic Precipitator (2×4 trường) (KKS flue-gas)
- **Chức năng:** Lọc bụi tro bay khỏi khói bằng tĩnh điện, đạt bụi ra < 30 mg/Nm³ (Design Basis).
- **Nguyên lý:** Điện trường cao áp DC ion hoá hạt bụi → hút về bản cực → gõ rũ (rapping) tro rơi xuống phễu; 2 dãy × 4 trường nối tiếp tăng hiệu suất (độ khử ~99,77% [GIẢ ĐỊNH] để đạt < 30).
- **Thiết bị:** Bản cực phóng/thu, bộ cao áp (T/R set) từng trường, búa gõ rũ, phễu tro.
- **Instrument:** Bụi ra ống khói (mg/Nm³), dòng/áp T/R từng trường, mức phễu tro.
- **PLC/DCS:** BOP + CEMS.
- **Interlock/Trip:** Nhiệt khói dưới điểm sương → nguy cơ ăn mòn; T/R chập → cô lập trường; phễu đầy → gõ rũ/xả.
- **Alarm:** Bụi ra cao (> 30 mg/Nm³ P2 — vượt mốc DB), T/R trường trip, phễu tro đầy.
- **Trend:** `EMI_DUST_STACK_01`, `EMI_ESP_EFF_01`, dòng T/R.
- **Faceplate:** ESP (bụi ra, hiệu suất, trạng thái 8 trường).
- **Tag:** `EMI_DUST_STACK_01` (mg/Nm³), `EMI_ESP_EFF_01` (%) [hiện thực — EmissionsModel, GĐ-69].
- **Animation:** Khói vào đục → ra trong; trường đổi màu khi trip.
- **Sequence:** SCS gõ rũ tuần tự từng trường; năng lượng hoá tối ưu theo tải.
- **SOP:** Đưa ESP vào trước khi cấp than; gõ rũ so le tránh tái cuốn bụi; theo dõi bụi ra so mốc phát thải.

## 6.20 FGD — Flue Gas Desulphurization (KKS flue-gas)
- **Chức năng:** Khử SO₂ trong khói (từ S 0,6% than) trước khi ra ống khói, đạt giới hạn phát thải.
- **Nguyên lý:** Wet limestone scrubber [GIẢ ĐỊNH loại] — khói tiếp xúc sữa đá vôi trong tháp hấp thụ → SO₂ + CaCO₃ → thạch cao (gypsum); độ khử ~95% [GIẢ ĐỊNH]. (Sự tồn tại FGD: hạng mục mở M-03 — xác nhận với chủ đầu tư.)
- **Thiết bị:** Tháp hấp thụ (absorber), bơm tuần hoàn sữa vôi, quạt tăng áp (booster), oxy hoá, tách nước gypsum.
- **Instrument:** SO₂ vào/ra FGD, pH sữa vôi, mức bể absorber, lưu lượng sữa vôi.
- **PLC/DCS:** BOP + CEMS.
- **Interlock/Trip:** pH ngoài dải → điều chỉnh cấp vôi; bơm tuần hoàn dừng → giảm khả năng khử → báo; bypass khi FGD sự cố (nếu cho phép).
- **Alarm:** SO₂ ra cao (vượt giới hạn P2), pH thấp/cao, mức bể absorber thấp, bơm tuần hoàn trip.
- **Trend:** `EMI_SO2_STACK_01`, `EMI_FGD_EFF_01`, pH.
- **Faceplate:** FGD (SO₂ vào/ra, hiệu suất khử, pH).
- **Tag:** `EMI_SO2_STACK_01` (mg/Nm³), `EMI_FGD_EFF_01` (%) [hiện thực — EmissionsModel]; breadth pH/mức/bơm.
- **Animation:** Khói qua tháp phun sữa vôi; gypsum ra.
- **Sequence:** SCS khởi động bơm tuần hoàn + cấp vôi trước khi đưa khói vào.
- **SOP:** Duy trì pH 5,5–6 [GIẢ ĐỊNH]; theo dõi SO₂ ra so giới hạn; quản lý gypsum + nước thải.

## 6.21 CEMS + Ống khói 210 m (KKS flue-gas)
- **Chức năng:** Quan trắc phát thải liên tục (SO₂, NOₓ, bụi, CO, O₂, lưu lượng khói) tại ống khói 210 m, báo cáo tuân thủ.
- **Nguyên lý:** Đầu đo tại ống khói lấy mẫu/đo tại chỗ; quy nồng độ mg/Nm³ ở điều kiện tiêu chuẩn (O₂ tham chiếu); truyền số liệu cơ quan môi trường.
- **Thiết bị:** Analyzer (SO₂/NOₓ/CO/O₂), đo bụi (opacity/scattering), đo lưu lượng khói, ống khói 210 m.
- **Instrument:** Toàn bộ analyzer CEMS + đo lưu lượng/nhiệt khói ống khói.
- **PLC/DCS:** CEMS độc lập, giao tiếp BOP/reporting.
- **Interlock/Trip:** Vượt giới hạn phát thải kéo dài → cảnh báo vận hành/giảm tải; analyzer lỗi → dùng giá trị dự phòng + báo.
- **Alarm:** SO₂/NOₓ/bụi/CO vượt giới hạn (P2), analyzer lỗi/hiệu chuẩn quá hạn.
- **Trend:** `EMI_SO2_STACK_01`, `EMI_NOX_STACK_01`, `EMI_DUST_STACK_01`, `EMI_CO2_RATE_01`, `EMI_FG_VOLUME_01`.
- **Faceplate:** CEMS (5 chỉ tiêu + giới hạn), ống khói.
- **Tag:** `EMI_SO2_STACK_01`, `EMI_NOX_STACK_01`, `EMI_DUST_STACK_01`, `EMI_CO2_RATE_01`, `EMI_FG_VOLUME_01` [hiện thực]; Hg/CO = pha sau (GĐ-69).
- **Animation:** Khói ra ống khói (độ đục theo bụi); bảng số CEMS.
- **Sequence:** — (đo liên tục; hiệu chuẩn tự động định kỳ).
- **SOP:** Hiệu chuẩn CEMS theo lịch; lưu số liệu; báo cáo vượt ngưỡng theo quy định.

---

# D. TURBINE & VAN HƠI

## 6.22 HP Turbine (KKS turbine)
- **Chức năng:** Giãn nở hơi chính 17,5 MPa/541 °C sinh công tầng cao áp; hơi thoát (cold reheat) về reheater.
- **Nguyên lý:** Hơi qua các tầng cánh HP, giãn tới ~4,2 MPa/330 °C; công ~28% tổng trục [GIẢ ĐỊNH F_HP]; tandem-compound cùng trục IP/LP.
- **Thiết bị:** Rotor HP, cánh tĩnh/động, chèn (gland), ổ trục.
- **Instrument:** Nhiệt/áp hơi vào HP, nhiệt cold reheat, dịch trục HP, rung ổ, giãn nở vỏ (differential expansion).
- **PLC/DCS:** TG (Turbine-Generator control) + turbine protection.
- **Interlock/Trip:** Vượt tốc, dịch trục cao, rung cao → turbine trip (đóng MSV); nhiệt hơi vào lệch lớn → cảnh báo sốc nhiệt.
- **Alarm:** Rung HP cao (P1), dịch trục cao (P1), differential expansion cao, nhiệt hơi vào cao/thấp.
- **Trend:** `TRB_HP_MW_01`, `TRB_CRH_TEMP_01`, rung/dịch trục HP.
- **Faceplate:** HP turbine (MW tầng, nhiệt vào/thoát, rung, dịch trục).
- **Tag:** `TRB_HP_MW_01`, `TRB_CRH_PRESS_01`, `TRB_CRH_TEMP_01` [hiện thực — ReheatCycleModel].
- **Animation:** Rotor quay (tốc độ), hơi giãn nở qua tầng.
- **Sequence:** SFC `turbine-roll` (doc 09): tăng tốc theo chương trình sưởi ấm chống sốc nhiệt.
- **SOP:** Sưởi turbine theo đường cong khởi động (cold/warm/hot start); theo dõi differential expansion + rung khi qua tốc độ tới hạn.

## 6.23 IP/LP Turbine — 2×LP (KKS turbine)
- **Chức năng:** Giãn nở hơi hot reheat (3,8 MPa/541 °C) qua IP rồi 2 thân LP tới bình ngưng, sinh phần lớn công.
- **Nguyên lý:** IP giãn hot reheat → crossover → 2 LP double-flow giãn tới chân không 5,4 kPa; công IP ~30% + LP ~42% [GIẢ ĐỊNH]; hơi ẩm cuối LP.
- **Thiết bị:** Rotor IP + 2 rotor LP, cánh dài LP, exhaust hood, spray làm mát LP hood.
- **Instrument:** Nhiệt hot reheat vào IP, nhiệt exhaust hood LP, rung/dịch trục IP/LP, chân không.
- **PLC/DCS:** TG.
- **Interlock/Trip:** Chân không thấp → turbine trip; nhiệt exhaust hood LP cao → spray làm mát; rung cao → trip.
- **Alarm:** Nhiệt exhaust hood LP cao (P1), chân không thấp (P1 → trip), rung IP/LP cao.
- **Trend:** `TRB_IP_MW_01`, `TRB_LP_MW_01`, `TRB_HRH_TEMP_01`, `TRB_COND_VACUUM_01`.
- **Faceplate:** IP/LP turbine (MW tầng, nhiệt hood, chân không).
- **Tag:** `TRB_IP_MW_01`, `TRB_LP_MW_01`, `TRB_HRH_TEMP_01` [hiện thực]; `TRB_COND_VACUUM_01` (boiler).
- **Animation:** Rotor IP/LP quay, hơi thoát xuống bình ngưng.
- **Sequence:** cùng `turbine-roll`/`gen-sync`; đảm bảo chân không trước khi tăng tải.
- **SOP:** Kích spray hood LP khi tải thấp/chạy không tải; theo dõi độ ẩm hơi cuối LP (xói mòn cánh).

## 6.24 Turbine Governor & Steam Valves — MSV/GV (KKS turbine)
- **Chức năng:** Điều tốc/tải turbine qua van chặn chính (MSV) + van điều tiết (GV); đóng nhanh khi trip.
- **Nguyên lý:** Governor điện-thuỷ lực điều GV theo droop 4–5% [GIẢ ĐỊNH]; MSV đóng nhanh (< 150 ms) khi trip qua hệ dầu điều khiển; phối hợp CCS (turbine-follow/boiler-follow/coordinated).
- **Thiết bị:** MSV, GV (4×), servo thuỷ lực, hệ dầu điều khiển (EH oil), overspeed trip.
- **Instrument:** Vị trí GV/MSV, tốc độ turbine (3000 rpm), áp dầu EH, tần số.
- **PLC/DCS:** TG governor + CCS coordination.
- **Interlock/Trip:** Vượt tốc 110% → mechanical + electrical overspeed trip → đóng MSV; xem §Deep-dive Turbine Trip.
- **Alarm:** Vượt tốc (P1), áp dầu EH thấp (P1), lệch tần số, GV kẹt.
- **Trend:** `TRB_SPEED_01`, `GEN_FREQ_01`, `BLR_TURBINE_DEMAND_01`, vị trí GV.
- **Faceplate:** Governor (tốc độ, GV%, mode, load setpoint).
- **Tag:** `TRB_SPEED_01`, `GEN_FREQ_01`, `BLR_TURBINE_DEMAND_01`, `TRB_TRIP`, `TRB_MSV_CLOSE` [hiện thực — GĐ-48 turbine trip đóng draw].
- **Animation:** GV độ mở, kim tốc độ, đóng nhanh khi trip.
- **Sequence:** SFC `gen-sync` (đồng bộ), `turbine-roll`; runback khi mill trip.
- **SOP:** Kiểm overspeed trip trước hoà lưới; chuyển coordinated control khi tải > 30%; test van (valve wobble) định kỳ.

## 6.25 Turbine Lube Oil & Gland Steam (KKS turbine)
- **Chức năng:** Cấp dầu bôi trơn/nâng trục các ổ turbine-generator; hơi chèn (gland steam) chống hơi thoát/khí lọt ổ trục.
- **Nguyên lý:** Bơm dầu chính (trục) + bơm phụ AC + bơm khẩn DC; jacking oil nâng trục khi turning gear; gland steam chèn trục + gland condenser thu hồi.
- **Thiết bị:** Bể dầu, bơm dầu (main/aux/emergency DC), làm mát dầu, jacking oil, gland steam header, gland condenser, turning gear.
- **Instrument:** Áp dầu bôi trơn, nhiệt dầu/ổ trục, mức bể dầu, áp gland steam.
- **PLC/DCS:** TG.
- **Interlock/Trip:** Áp dầu bôi trơn thấp → turbine trip + khởi động bơm DC khẩn; nhiệt ổ trục cao → trip.
- **Alarm:** Áp dầu bôi trơn thấp (P1 → trip), nhiệt ổ trục cao (P1), mức bể dầu thấp, mất gland steam.
- **Trend:** Áp/nhiệt dầu, nhiệt ổ trục, `GEN_STATOR_TEMP_01` (liên quan).
- **Faceplate:** Lube oil (áp, nhiệt, bơm chạy), bearing temps.
- **Tag:** breadth `10MAV*` (áp/nhiệt dầu, nhiệt ổ trục), `GEN_STATOR_TEMP_01` [hiện thực].
- **Animation:** Bơm dầu chạy, dầu tuần hoàn tới ổ trục.
- **Sequence:** Khởi động bơm dầu + jacking oil + turning gear trước khi roll turbine.
- **SOP:** Xác nhận áp dầu + turning gear trước turbine roll; bơm DC là dự phòng cuối chống hỏng ổ trục khi mất điện.

## 6.26 Turbine Bypass — HP/LP (KKS turbine)
- **Chức năng:** Đường tắt hơi (HP bypass: hơi chính → cold reheat; LP bypass: hot reheat → bình ngưng) cho khởi động, thải tải nhanh, chống vượt áp.
- **Nguyên lý:** Khi turbine chưa nhận/giảm tải đột ngột, bypass xả hơi vòng qua turbine (kèm giảm ôn/giảm áp) → cân bằng lò-turbine, giữ lưu lượng hơi RH.
- **Thiết bị:** Van HP bypass + LP bypass (kèm spray giảm ôn), bộ điều khiển bypass.
- **Instrument:** Vị trí van bypass, áp/nhiệt trước-sau bypass, chân không bình ngưng (giới hạn LP bypass).
- **PLC/DCS:** CCS/TG (bypass control).
- **Interlock/Trip:** Chân không thấp → giới hạn/đóng LP bypass (bảo vệ bình ngưng); áp hơi chính cao → mở HP bypass.
- **Alarm:** Bypass mở bất thường, nhiệt sau bypass cao (spray không đủ), áp hơi chính cao.
- **Trend:** Vị trí HP/LP bypass, áp hơi chính, chân không.
- **Faceplate:** Bypass (HP/LP độ mở, áp/nhiệt).
- **Tag:** breadth `10MAN*` (vị trí/áp bypass). [GIẢ ĐỊNH KKS]
- **Animation:** Van bypass mở, hơi vòng qua turbine.
- **Sequence:** SFC khởi động: HP/LP bypass mở giữ áp/lưu lượng RH trước khi roll turbine, đóng dần khi turbine nhận tải.
- **SOP:** Dùng bypass khi khởi động và load rejection; giữ giảm ôn đủ để không quá nhiệt bình ngưng.

---

# E. BÌNH NGƯNG & NƯỚC TUẦN HOÀN

## 6.27 Condenser (KKS cw)
- **Chức năng:** Ngưng hơi thoát LP thành nước ngưng ở chân không 5,4 kPa; thải nhiệt (~890 MWth đầy tải) cho nước tuần hoàn.
- **Nguyên lý:** Hơi thoát LP ngưng trên chùm ống CW lạnh; chân không do ngưng tụ + hút khí không ngưng; nhiệt bão hoà ~34 °C (ở 5,4 kPa); cân bằng năng lượng: nhiệt thải = nhiệt cấp − công suất.
- **Thiết bị:** Bình ngưng (shell + tube), hotwell, ống CW, hệ hút khí (§6.30).
- **Instrument:** Chân không bình ngưng, mức hotwell, nhiệt CW vào/ra, nhiệt bão hoà, TTD.
- **PLC/DCS:** BOP + TG (chân không là điều kiện turbine).
- **Interlock/Trip:** Chân không thấp → turbine trip; mức hotwell cao/thấp → điều khiển/bổ sung.
- **Alarm:** Chân không thấp (P1 → trip), mức hotwell cao/thấp, nhiệt CW ra cao (hiệu năng), TTD cao (bám bẩn ống).
- **Trend:** `TRB_COND_VACUUM_01`, `COND_DUTY_01`, `COND_SAT_TEMP_01`, `COND_TTD_01`, `COND_CW_RISE_01`.
- **Faceplate:** Condenser (chân không, duty, nhiệt CW, mức hotwell).
- **Tag:** `COND_DUTY_01`, `COND_SAT_TEMP_01`, `COND_TTD_01`, `COND_CW_IN/OUT_TEMP_01`, `TRB_COND_VACUUM_01` [hiện thực — CondenserCWModel, GĐ-67].
- **Animation:** Hơi ngưng thành nước, mức hotwell, CW chảy qua ống.
- **Sequence:** SFC khởi động chân không (chạy hút khí + gland steam) trước turbine roll.
- **SOP:** Lập chân không trước roll turbine; theo dõi TTD (bám bẩn/ngập ống); vệ sinh ống CW định kỳ.

## 6.28 Condensate System (KKS cw)
- **Chức năng:** Bơm nước ngưng từ hotwell qua đoàn LP heater tới deaerator; duy trì mức hotwell + bổ sung nước ngưng (makeup).
- **Nguyên lý:** Bơm ngưng (2×100%, 1 chạy/1 dự phòng) đẩy nước ngưng; điều mức hotwell bằng van recirc/makeup; qua polisher (khử khoáng) rồi 4 LP heater lên deaerator.
- **Thiết bị:** 2 bơm ngưng, condensate polisher, van recirc, bể makeup ngưng.
- **Instrument:** Mức hotwell, áp/lưu lượng bơm ngưng, độ dẫn nước ngưng (polisher), nhiệt.
- **PLC/DCS:** BOP.
- **Interlock/Trip:** Mức hotwell thấp → trip bơm ngưng (chống cavitation); áp đẩy thấp → khởi bơm dự phòng.
- **Alarm:** Mức hotwell thấp (trip bơm), độ dẫn cao (polisher hết tác dụng), bơm ngưng trip.
- **Trend:** Mức hotwell, `FW_CONDENSATE_TEMP_01`, lưu lượng ngưng.
- **Faceplate:** Bơm ngưng (chạy/dừng, áp), hotwell (mức).
- **Tag:** `FW_CONDENSATE_TEMP_01` (°C), `FW_FLOW_01` [hiện thực — FeedwaterTrainModel]; breadth mức hotwell/bơm.
- **Animation:** Bơm ngưng chạy, nước ngưng (màu `#29A38A`) lên đoàn gia nhiệt.
- **Sequence:** Khởi động bơm ngưng khi có chân không + mức hotwell đủ.
- **SOP:** Chạy 1 bơm + auto-start dự phòng; theo dõi polisher; bổ sung makeup giữ mức hotwell.

## 6.29 Circulating Water — CW Pump (KKS cw)
- **Chức năng:** Cấp nước tuần hoàn 64.000 m³/h làm mát bình ngưng; nhận nhiệt thải rồi về tháp làm mát.
- **Nguyên lý:** 2 CW pump 50% hút từ bể tháp làm mát đẩy qua ống bình ngưng; ΔT ~12 °C (nhiệt thải/lưu lượng); van xả khí/chân không đầu ống.
- **Thiết bị:** 2 CW pump (lớn), ống CW, van, lưới chắn rác (trash rack/traveling screen).
- **Instrument:** Lưu lượng CW, áp/dòng bơm, nhiệt CW vào/ra, chênh áp lưới chắn rác.
- **PLC/DCS:** BOP.
- **Interlock/Trip:** Mất cả 2 CW pump → chân không sập → turbine trip; lưới chắn rác nghẽn → báo/rửa.
- **Alarm:** CW pump trip (P1 nếu mất làm mát), lưu lượng CW thấp, lưới chắn rác nghẽn.
- **Trend:** `COND_CW_FLOW_01`, `COND_CW_IN/OUT_TEMP_01`, dòng CW pump.
- **Faceplate:** CW pump (chạy/dừng, áp, dòng), lưu lượng CW.
- **Tag:** `COND_CW_FLOW_01` (64.000), `COND_CW_IN/OUT_TEMP_01`, `COND_CW_RISE_01` [hiện thực].
- **Animation:** CW pump quay, nước tuần hoàn (màu `#1FA5D6`).
- **Sequence:** Khởi động CW pump trước khi lập chân không.
- **SOP:** Chạy CW trước roll turbine; theo dõi ΔT + lưới chắn rác; 1 pump trip → giảm tải theo khả năng làm mát.

## 6.30 Cooling Tower + Vacuum System (KKS cw)
- **Chức năng:** Tháp làm mát (natural draft 165 m) thải nhiệt CW ra khí quyển; hệ hút khí duy trì chân không bình ngưng.
- **Nguyên lý:** CW nóng phun trong tháp, bốc hơi + đối lưu tự nhiên (hyperbolic) làm mát về bầu ướt + approach (~31 °C ở bầu ướt 27 °C [GIẢ ĐỊNH]); air ejector/vacuum pump hút khí không ngưng.
- **Thiết bị:** Tháp làm mát hyperbolic, fill, bể thu, bơm nước bổ sung; air ejector (steam) hoặc vacuum pump.
- **Instrument:** Bầu ướt, nhiệt CW cấp/về, bốc hơi/nước bổ sung, áp hút khí.
- **PLC/DCS:** BOP.
- **Interlock/Trip:** Mất hút khí → chân không giảm → cảnh báo/turbine; mức bể tháp thấp → bổ sung.
- **Alarm:** Chân không giảm (hút khí kém), mức bể tháp thấp, nước bổ sung cao (rò rỉ), bầu ướt cao (giảm chân không mùa nóng).
- **Trend:** `CT_WETBULB_01`, `CT_CW_SUPPLY_01`, `CT_APPROACH_01`, `CT_EVAP_LOSS_01`, `CT_MAKEUP_01`.
- **Faceplate:** Cooling tower (bầu ướt, CW cấp/range, bốc hơi, bổ sung).
- **Tag:** `CT_WETBULB_01`, `CT_CW_SUPPLY_01`, `CT_APPROACH_01`, `CT_RANGE_01`, `CT_HEAT_REJECT_01`, `CT_EVAP_LOSS_01`, `CT_MAKEUP_01` [hiện thực — CoolingTowerModel, GĐ-71].
- **Animation:** Hơi nước bốc lên tháp, CW tuần hoàn.
- **Sequence:** Chạy hút khí + gland steam để lập chân không khởi động.
- **SOP:** Duy trì hoá nước CW (blowdown); mùa nóng bầu ướt cao → chân không xấu → giảm tải (GĐ-71: 5,4 kPa là mốc ôn hoà).

---

# F. NƯỚC CẤP & GIA NHIỆT

## 6.31 LP Feedwater Heaters — 4× (KKS boiler)
- **Chức năng:** Gia nhiệt hồi nhiệt nước ngưng bằng hơi trích LP trước deaerator (condensate → ~178 °C).
- **Nguyên lý:** 4 gia nhiệt bề mặt nối tiếp, dùng hơi trích các tầng LP; drain cascade từ heater áp cao xuống áp thấp; nâng hiệu suất chu trình.
- **Thiết bị:** 4 LP heater (shell-tube), đường hơi trích, drain cooler, van drain.
- **Instrument:** Nhiệt nước ra từng heater, mức drain heater, nhiệt hơi trích.
- **PLC/DCS:** BOP.
- **Interlock/Trip:** Mức drain cao → nguy cơ nước vào turbine qua đường trích → đóng trích + xả khẩn; bypass heater khi sự cố.
- **Alarm:** Mức drain heater cao (P2 — bảo vệ turbine), nhiệt nước ra thấp (heater kém).
- **Trend:** `FW_DEAERATOR_TEMP_01` (điểm cuối LP train), `FW_REGEN_DUTY_01`.
- **Faceplate:** LP heater train (nhiệt vào/ra, mức drain).
- **Tag:** `FW_DEAERATOR_TEMP_01`, `FW_REGEN_DUTY_01` [hiện thực — FeedwaterTrainModel gộp đoàn LP]; từng heater riêng = pha sau (GĐ-66).
- **Animation:** Nước ngưng qua 4 heater (nhiệt tăng dần), hơi trích vào.
- **Sequence:** Đưa hơi trích vào heater theo tải turbine tăng.
- **SOP:** Theo dõi mức drain (bảo vệ turbine); bypass heater rò ống; drain cascade đúng chiều.

## 6.32 Deaerator (KKS boiler)
- **Chức năng:** Khử khí hoà tan (O₂/CO₂) khỏi nước cấp bằng gia nhiệt tiếp xúc hơi; chứa nước cấp cho BFP (0,9 MPa/178 °C).
- **Nguyên lý:** Nước ngưng phun tiếp xúc hơi trích → khử khí (chống ăn mòn) + gia nhiệt tới bão hoà 178 °C; bình chứa (storage tank) đệm cho BFP.
- **Thiết bị:** Tháp khử khí, bình chứa nước cấp, hơi trích/pegging, van thông hơi (vent).
- **Instrument:** Mức deaerator, áp/nhiệt deaerator (0,9 MPa/178 °C), O₂ hoà tan.
- **PLC/DCS:** BOP — loop mức deaerator + áp (pegging steam).
- **Interlock/Trip:** Mức thấp → nguy cơ cavitation BFP → trip BFP; áp thấp → pegging steam.
- **Alarm:** Mức deaerator cao/thấp (P2, thấp → bảo vệ BFP), O₂ hoà tan cao (khử khí kém), áp thấp.
- **Trend:** `FW_DEAERATOR_TEMP_01`, mức deaerator, O₂ hoà tan.
- **Faceplate:** Deaerator (mức, áp/nhiệt, O₂).
- **Tag:** `FW_DEAERATOR_TEMP_01` (178 °C) [hiện thực]; breadth mức/áp/O₂ deaerator.
- **Animation:** Nước phun trong tháp, hơi khử khí, mức bình chứa.
- **Sequence:** Cấp pegging steam giữ áp/khử khí trước khi khởi BFP.
- **SOP:** Giữ mức + áp deaerator ổn định (đệm BFP); theo dõi O₂ hoà tan < giới hạn chống ăn mòn.

## 6.33 Boiler Feed Pump — BFP (KKS boiler)
- **Chức năng:** Bơm nước cấp từ deaerator qua HP heater + economizer vào drum ở áp > 18,9 MPa.
- **Nguyên lý:** 2 bơm turbine-driven 50% (TDBFP) chạy chính + 1 bơm motor-driven 30% (MDBFP) khởi động/dự phòng; điều lưu lượng theo loop mức drum; recirc chống quá nhiệt lưu lượng thấp.
- **Thiết bị:** 2 TDBFP + 1 MDBFP, booster pump, van recirc, khớp thuỷ lực/biến tốc.
- **Instrument:** Áp/lưu lượng nước cấp, dòng/tốc bơm, nhiệt gối bơm, mức deaerator (hút).
- **PLC/DCS:** CCS (lưu lượng theo drum level) + BOP.
- **Interlock/Trip:** Mức deaerator thấp → trip BFP; lưu lượng thấp không recirc → quá nhiệt → trip; mất BFP → runback/MFT (mất nước cấp).
- **Alarm:** Áp nước cấp thấp (P1), lưu lượng thấp (recirc), nhiệt gối bơm cao, BFP trip.
- **Trend:** `FW_FLOW_01`, áp nước cấp, tốc TDBFP.
- **Faceplate:** BFP (chạy/dừng, áp, lưu lượng, tốc).
- **Tag:** `FW_FLOW_01` (t/h), `FW_ECON_INLET_TEMP_01` [hiện thực]; breadth áp/tốc BFP.
- **Animation:** BFP quay, nước cấp áp cao lên HP heater.
- **Sequence:** Khởi MDBFP điền lò → chuyển TDBFP khi có hơi; recirc mở khi lưu lượng thấp.
- **SOP:** Khởi động bằng MDBFP; chuyển TDBFP khi hơi đủ; luôn giữ đường recirc khi lưu lượng thấp.

## 6.34 HP Feedwater Heaters — 3× (KKS boiler)
- **Chức năng:** Gia nhiệt hồi nhiệt nước cấp sau BFP bằng hơi trích HP/reheat lên 283 °C (vào economizer).
- **Nguyên lý:** 3 gia nhiệt bề mặt áp cao dùng hơi trích HP + cold reheat; drain cascade về deaerator; nước cấp càng nóng → nhiệt cấp lò càng ít → hiệu suất tốt (thể hiện qua `PLANT_CYCLE_HR_01`).
- **Thiết bị:** 3 HP heater (áp cao), đường hơi trích, drain cooler, van drain + bypass.
- **Instrument:** Nhiệt nước ra từng HP heater (cuối = 283 °C), mức drain, nhiệt hơi trích.
- **PLC/DCS:** BOP.
- **Interlock/Trip:** Mức drain cao → đóng trích + xả (bảo vệ turbine); bypass khi rò ống.
- **Alarm:** Mức drain HP heater cao (P2), nhiệt nước ra economizer thấp (heater kém → hiệu suất giảm).
- **Trend:** `FW_ECON_INLET_TEMP_01` (283 °C), `FW_REGEN_DUTY_01`, `PLANT_CYCLE_HR_01`.
- **Faceplate:** HP heater train (nhiệt vào/ra, mức drain), heat rate chu trình.
- **Tag:** `FW_ECON_INLET_TEMP_01` (283), `FW_REGEN_DUTY_01`, `PLANT_CYCLE_HR_01` [hiện thực — màn D3-feedwater-heatrate].
- **Animation:** Nước cấp qua 3 HP heater (nhiệt tăng tới 283 °C), hơi trích vào.
- **Sequence:** Đưa hơi trích HP heater theo tải; bypass khi khởi động lạnh.
- **SOP:** Theo dõi mức drain (bảo vệ turbine); nhiệt nước cấp 283 °C là chỉ báo hiệu suất hồi nhiệt.

---

# G. ĐIỆN

## 6.35 Generator — 667 MVA (KKS generator)
- **Chức năng:** Biến cơ năng trục turbine thành điện 20 kV; công suất gộp 600 MW ở cosφ 0,9.
- **Nguyên lý:** Máy phát đồng bộ 2 cực 3000 rpm/50 Hz; stator làm mát nước, rotor làm mát H₂; kích từ tạo từ trường rotor; P theo cơ năng, Q theo kích từ.
- **Thiết bị:** Stator (water-cooled), rotor (H₂-cooled), hệ H₂ (áp/độ tinh khiết), hệ nước stator, chèn dầu H₂ seal.
- **Instrument:** Công suất P/Q, điện áp/dòng stator, nhiệt stator, áp/độ tinh khiết H₂, nhiệt nước stator, tần số.
- **PLC/DCS:** ECS (Electrical Control) + generator protection (ANSI, §Deep-dive).
- **Interlock/Trip:** Generator protection trip (87G/40/46/32…) → turbine trip (unit trip); nhiệt stator cao → giảm tải; mất làm mát H₂/nước stator → trip.
- **Alarm:** Nhiệt stator cao (P1), áp H₂ thấp/độ tinh khiết thấp (P1 nổ), mất nước làm mát stator, quá tải.
- **Trend:** `GEN_MW_01`, `GEN_MVAR_01`, `GEN_STATOR_TEMP_01`, `GEN_FREQ_01`, `ELEC_GEN_MVA_01`, `ELEC_GEN_CURRENT_01`.
- **Faceplate:** Generator (P/Q/MVA, pf, điện áp/dòng stator, nhiệt, H₂).
- **Tag:** `GEN_MW_01`, `GEN_MVAR_01`, `GEN_STATOR_TEMP_01`, `GEN_FREQ_01`, `ELEC_GEN_MVA_01`, `ELEC_PF_01`, `ELEC_GEN_CURRENT_01` [hiện thực — TurbineGeneratorModel + ElectricalModel].
- **Animation:** Máy phát (P/Q kim), stator đổi màu khi nhiệt cao.
- **Sequence:** SFC `gen-sync` (doc 09): synchro-check (áp/tần/pha) → đóng máy cắt → nhận tải.
- **SOP:** Kiểm H₂/nước stator trước hoà; theo dõi capability curve (P-Q); nhiệt stator giới hạn tải.

## 6.36 Excitation / AVR (KKS generator)
- **Chức năng:** Cấp dòng kích từ rotor điều điện áp đầu cực/công suất phản kháng; ổn định hệ thống (PSS).
- **Nguyên lý:** Static/brushless exciter cấp DC rotor; AVR điều điện áp đầu cực theo setpoint; limiter (OEL/UEL) giữ trong capability; PSS giảm dao động công suất. (AVR/PSS chi tiết = pha sau — GĐ-70.)
- **Thiết bị:** Exciter, AVR, field breaker, limiter, PSS, field flashing.
- **Instrument:** Dòng/áp kích từ, điện áp đầu cực, Q, tần số.
- **PLC/DCS:** ECS (AVR loop).
- **Interlock/Trip:** Mất kích từ (loss of field 40) → trip; quá kích/thiếu kích (OEL/UEL) → limiter; over-voltage (59) → điều chỉnh/trip.
- **Alarm:** Mất kích từ (P1), quá/thiếu kích, điện áp đầu cực lệch, field ground (64F).
- **Trend:** `GEN_MVAR_01`, điện áp đầu cực, dòng kích từ, `ELEC_PF_01`.
- **Faceplate:** AVR (điện áp SP/PV, Q, dòng kích từ, mode AVR/manual).
- **Tag:** `GEN_MVAR_01`, `ELEC_PF_01` [hiện thực]; breadth dòng/áp kích từ, `10ME*`.
- **Animation:** Kim Q, kích từ (dòng), capability curve.
- **Sequence:** Field flashing → AVR đưa điện áp đầu cực lên định mức trước synchro.
- **SOP:** AVR ở auto khi hoà lưới; theo dõi capability P-Q; test PSS định kỳ.

## 6.37 GSU + UAT Transformers (KKS electrical)
- **Chức năng:** GSU nâng 20→500 kV xuất lưới; UAT hạ 20→6,6 kV cấp tự dùng tổ máy (~7%).
- **Nguyên lý:** GSU 720 MVA YNd11; UAT 2×50 MVA; net = gộp − tự dùng (600−42=558 MW); tổn thất GSU ~0,4% [GIẢ ĐỊNH].
- **Thiết bị:** GSU (20/500 kV), 2 UAT (20/6,6 kV), OLTC (nếu có), làm mát dầu (ONAN/ONAF), Buchholz.
- **Instrument:** Dòng/áp/tải MVA GSU+UAT, nhiệt dầu/cuộn dây, mức dầu, Buchholz gas.
- **PLC/DCS:** ECS + transformer protection (87T, Buchholz).
- **Interlock/Trip:** Differential (87T)/Buchholz → trip máy biến áp + máy cắt; nhiệt dầu cao → quạt làm mát/giảm tải.
- **Alarm:** Nhiệt dầu/cuộn dây cao (P2), quá tải GSU/UAT (>100% P2), Buchholz gas, mức dầu thấp.
- **Trend:** `ELEC_GRID_MW_01`, `ELEC_GSU_LOADING_01`, `ELEC_AUX_LOADING_01`, `ELEC_AUX_POWER_01`.
- **Faceplate:** GSU/UAT (tải %, nhiệt dầu, dòng), xuất lưới.
- **Tag:** `ELEC_GRID_MW_01`, `ELEC_GSU_LOADING_01`, `ELEC_AUX_LOADING_01`, `ELEC_AUX_POWER_01`, `ELEC_NET_MW_01` [hiện thực — ElectricalModel, GĐ-70].
- **Animation:** Dòng công suất 20→500 kV; UAT xuống tự dùng.
- **Sequence:** — (đóng điện GSU trước hoà; UAT cấp tự dùng khi khởi động qua station transformer).
- **SOP:** Theo dõi nhiệt/tải máy biến áp; chuyển nguồn tự dùng station↔UAT khi hoà/tách lưới.

## 6.38 Switchyard 500 kV (KKS switchyard)
- **Chức năng:** Đấu nối tổ máy vào lưới 500 kV; đóng cắt, cách ly, bảo vệ đường dây, đồng bộ (synchro-check), tự đóng lại (auto-recloser).
- **Nguyên lý:** Sơ đồ 1½ máy cắt/hoặc double busbar [GIẢ ĐỊNH]; bay control đóng cắt máy cắt/dao cách ly theo interlock; synchro-check trước đóng; IEC 61850 GOOSE giữa IED. (Switchyard chi tiết = pha sau — GĐ-70.)
- **Thiết bị:** Máy cắt 500 kV, dao cách ly, CT/VT, chống sét, thanh cái, bay control IED.
- **Instrument:** Trạng thái máy cắt/dao, dòng/áp đường dây, đồng bộ (áp/tần/pha), SF6 áp.
- **PLC/DCS:** ECS + line protection (21/87L) + IEC 61850.
- **Interlock/Trip:** Interlock đóng cắt (dao chỉ thao tác khi máy cắt mở); bảo vệ đường dây trip → cắt máy cắt; auto-recloser theo logic.
- **Alarm:** Máy cắt trip, SF6 áp thấp, mất đồng bộ, dao cách ly sai vị trí.
- **Trend:** Dòng/áp đường dây, `ELEC_GRID_MW_01`, tần số lưới.
- **Faceplate:** Bay 500 kV (máy cắt/dao trạng thái, dòng/áp, synchro).
- **Tag:** breadth `10BB*` (máy cắt/dao/đo lường 500 kV); `ELEC_GRID_MW_01` [hiện thực]. [GIẢ ĐỊNH KKS]
- **Animation:** Single-line 500 kV: máy cắt đóng/mở (xanh/đỏ), dòng công suất.
- **Sequence:** SFC `gen-sync`: synchro-check → đóng máy cắt máy phát → nhận tải.
- **SOP:** Thao tác dao cách ly chỉ khi máy cắt mở; synchro-check bắt buộc trước đóng; theo dõi SF6.

## 6.39 Emergency Diesel Generator (KKS diesel)
- **Chức năng:** Cấp điện khẩn cấp cho phụ tải an toàn (dầu bôi trơn, turning gear, DC charger…) khi mất điện toàn nhà máy (blackout).
- **Nguyên lý:** Diesel genset tự khởi động khi mất điện bus khẩn (undervoltage), đóng lên bus khẩn trong ~10–15 s [GIẢ ĐỊNH]; cấp phụ tải bảo vệ thiết bị.
- **Thiết bị:** Động cơ diesel + máy phát, bồn dầu diesel, ắc quy khởi động, ATS (auto transfer switch).
- **Instrument:** Điện áp/tần/công suất DG, áp dầu/nhiệt nước diesel, mức dầu diesel, trạng thái bus khẩn.
- **PLC/DCS:** ECS (DG control + load shedding/sequencing).
- **Interlock/Trip:** Mất điện bus khẩn → auto-start DG → đóng bus; áp dầu diesel thấp/quá tốc → trip DG.
- **Alarm:** DG auto-start (sự kiện), DG fail-to-start (P1), mức dầu diesel thấp, quá tải DG.
- **Trend:** Công suất DG, điện áp bus khẩn, mức dầu diesel.
- **Faceplate:** Diesel generator (chạy/dừng, công suất, áp dầu, mức nhiên liệu).
- **Tag:** breadth `10GU*` (DG status/công suất/dầu). [GIẢ ĐỊNH KKS]
- **Animation:** DG khởi động, cấp bus khẩn (đổi màu bus).
- **Sequence:** SCS load sequencing: DG lên → đóng phụ tải khẩn theo thứ tự ưu tiên.
- **SOP:** Test DG định kỳ (no-load/on-load); giữ dầu diesel đầy; kiểm ATS + ắc quy khởi động.

## 6.40 UPS & Battery — DC 220/110 V (KKS ups)
- **Chức năng:** Cấp điện một chiều/không gián đoạn cho điều khiển, bảo vệ, đóng cắt, chiếu sáng sự cố khi mất AC.
- **Nguyên lý:** Ắc quy DC 220 V (đóng cắt) + 110 V (điều khiển/bảo vệ) [GIẢ ĐỊNH] nạp từ charger; UPS (inverter) cấp AC không gián đoạn cho DCS/máy tính; tự chuyển khi mất nguồn.
- **Thiết bị:** Bộ ắc quy 220/110 V, charger, UPS inverter, bảng phân phối DC.
- **Instrument:** Điện áp/dòng DC bus, dòng nạp/phóng ắc quy, trạng thái charger/UPS, điện trở cách điện DC.
- **PLC/DCS:** ECS (giám sát DC/UPS).
- **Interlock/Trip:** Mất charger → ắc quy cấp (giới hạn thời gian); chạm đất DC → báo (giữ vận hành); UPS bypass khi lỗi inverter.
- **Alarm:** Điện áp DC thấp (P1 mất bảo vệ), charger lỗi, chạm đất DC, UPS sang bypass/battery.
- **Trend:** Điện áp DC 220/110 V, dòng ắc quy, tải UPS.
- **Faceplate:** DC system (áp bus, ắc quy nạp/phóng, charger/UPS trạng thái).
- **Tag:** breadth `10GH*` (áp/dòng DC, UPS status). [GIẢ ĐỊNH KKS]
- **Animation:** Bus DC (áp), ắc quy nạp/phóng, UPS nguồn (line/battery).
- **Sequence:** UPS auto-transfer khi mất AC; ắc quy phóng theo thời gian dự phòng.
- **SOP:** Test dung lượng ắc quy định kỳ; theo dõi chạm đất DC; đảm bảo thời gian dự phòng ≥ yêu cầu.

---

# H. HOÁ & PHỤ TRỢ

## 6.41 Water Treatment — DM Plant (KKS wtp)
- **Chức năng:** Sản xuất nước khử khoáng (demineralized) bổ sung cho chu trình hơi–nước (makeup); chất lượng nước cấp lò.
- **Nguyên lý:** Nước thô → lọc → trao đổi ion (cation/anion/mixed bed) hoặc RO+EDI [GIẢ ĐỊNH] → nước DM độ dẫn thấp; bể chứa DM cấp condenser makeup.
- **Thiết bị:** Bộ lọc, cột trao đổi ion/RO, bể DM, bơm makeup, tái sinh hoá chất.
- **Instrument:** Độ dẫn/SiO₂/pH nước DM, mức bể DM, lưu lượng makeup.
- **PLC/DCS:** BOP/SCS (DM plant).
- **Interlock/Trip:** Độ dẫn nước DM cao → không cấp vào chu trình (chuyển tái sinh); bể DM thấp → hạn chế makeup.
- **Alarm:** Độ dẫn/SiO₂ nước DM cao (P2 chemistry), mức bể DM thấp, cột cần tái sinh.
- **Trend:** Độ dẫn nước DM, mức bể DM, lưu lượng makeup.
- **Faceplate:** DM plant (chất lượng nước, mức bể, cột trạng thái).
- **Tag:** breadth `10GC*` (độ dẫn/SiO₂/mức/lưu lượng). [GIẢ ĐỊNH KKS]
- **Animation:** Dòng nước qua cột trao đổi ion, mức bể DM.
- **Sequence:** SCS chu trình tái sinh cột (rửa ngược → hoá chất → rửa xuôi).
- **SOP:** Giữ chất lượng nước DM đạt chuẩn nước cấp lò; tái sinh khi cột bão hoà; theo dõi tồn kho hoá chất.

## 6.42 Chemical Dosing (KKS dosing)
- **Chức năng:** Định lượng hoá chất giữ chất lượng nước–hơi: phosphate (drum), hydrazine (khử O₂), ammonia (điều pH nước ngưng).
- **Nguyên lý:** Bơm định lượng châm hoá chất vào điểm phù hợp: phosphate vào drum (chống cáu cặn), hydrazine vào nước cấp (khử O₂ dư), ammonia vào nước ngưng (nâng pH chống ăn mòn).
- **Thiết bị:** Bơm định lượng (metering), bồn pha hoá chất, đường châm, khuấy.
- **Instrument:** pH/độ dẫn/O₂ tại các điểm, mức bồn hoá chất, hành trình bơm định lượng.
- **PLC/DCS:** BOP (dosing control theo chemistry).
- **Interlock/Trip:** Mức bồn hoá chất thấp → dừng bơm + báo; pH/O₂ ngoài dải → điều chỉnh liều.
- **Alarm:** pH nước ngưng/cấp ngoài dải (P2), O₂ hoà tan cao, phosphate drum ngoài dải, mức bồn thấp.
- **Trend:** pH nước ngưng, O₂ nước cấp, phosphate drum.
- **Faceplate:** Dosing (bơm định lượng chạy/liều, mức bồn, chemistry).
- **Tag:** breadth `10GD*` (pH/O₂/liều/mức). [GIẢ ĐỊNH KKS]
- **Animation:** Bơm định lượng châm, mức bồn hoá chất.
- **Sequence:** — (định lượng liên tục theo tín hiệu chemistry).
- **SOP:** Giữ chemistry trong dải (phosphate/pH/O₂); pha hoá chất an toàn; theo dõi tồn kho.

## 6.43 Compressed & Instrument Air (KKS air)
- **Chức năng:** Cấp khí nén dịch vụ (service air) và khí nén dụng cụ (instrument air, khô-sạch) cho van khí nén, dụng cụ.
- **Nguyên lý:** Máy nén khí → bình chứa → sấy khô (dryer) → instrument air (điểm sương thấp); service air không sấy; giữ áp header.
- **Thiết bị:** 2–3 máy nén (1 dự phòng), bình chứa, dryer, lọc, header phân phối.
- **Instrument:** Áp header instrument/service air, điểm sương khí instrument, dòng máy nén, mức dầu.
- **PLC/DCS:** BOP (compressor sequencing).
- **Interlock/Trip:** Áp instrument air thấp → van khí nén về vị trí an toàn (fail-safe) → ảnh hưởng vận hành → báo P1; auto-start máy nén dự phòng.
- **Alarm:** Áp instrument air thấp (P1 mất điều khiển van), điểm sương cao (ẩm → kẹt van), máy nén trip.
- **Trend:** Áp header instrument/service air, điểm sương.
- **Faceplate:** Air compressor (chạy/dừng, áp, dòng), header (áp).
- **Tag:** breadth `10QF*` (áp/điểm sương/máy nén). [GIẢ ĐỊNH KKS]
- **Animation:** Máy nén chạy, áp header (bargraph).
- **Sequence:** SCS compressor sequencing (lead/lag + auto-start dự phòng theo áp).
- **SOP:** Ưu tiên bảo đảm instrument air (fail-safe van); theo dõi điểm sương; xả nước ngưng bình chứa.

## 6.44 Fire Fighting (KKS fire)
- **Chức năng:** Phát hiện & chữa cháy các khu vực nguy cơ (than, dầu, máy biến áp, cáp, turbine); bảo vệ người & thiết bị.
- **Nguyên lý:** Hệ nước chữa cháy (bơm jockey + điện + diesel giữ áp mạng), sprinkler/deluge khu dầu/biến áp, CO₂/khí cho phòng điện/cáp; detector khói/nhiệt/lửa báo về hệ báo cháy.
- **Thiết bị:** Bơm chữa cháy (jockey/electric/diesel), mạng ống + hydrant, deluge/sprinkler, hệ khí, detector, tủ báo cháy (FACP).
- **Instrument:** Áp mạng chữa cháy, trạng thái bơm, detector khói/nhiệt/lửa từng vùng, mức bể nước.
- **PLC/DCS:** Hệ báo cháy độc lập (FACP) + tín hiệu tới DCS.
- **Interlock/Trip:** Detector kích hoạt → deluge/khí vùng tương ứng + báo; áp mạng thấp → auto-start bơm; xả khí phòng điện → dừng HVAC vùng.
- **Alarm:** Báo cháy vùng (P1), áp mạng chữa cháy thấp, bơm chữa cháy fail, detector lỗi.
- **Trend:** Áp mạng chữa cháy, mức bể nước, trạng thái vùng.
- **Faceplate:** Fire zones (trạng thái detector/deluge), bơm chữa cháy.
- **Tag:** breadth `10SG*` (detector/bơm/áp mạng). [GIẢ ĐỊNH KKS]
- **Animation:** Sơ đồ vùng cháy (bình thường/báo cháy nhấp nháy), bơm chạy.
- **Sequence:** SCS auto-start bơm theo áp; kích deluge theo detector zone.
- **SOP:** Test bơm/detector định kỳ; giữ áp mạng; quy trình sơ tán + phối hợp PCCC.

## 6.45 HVAC (KKS hvac)
- **Chức năng:** Điều hoà không khí/thông gió phòng điều khiển, phòng điện, DCS, MCC; giữ nhiệt độ/độ ẩm/áp dương thiết bị điện tử.
- **Nguyên lý:** AHU + chiller cấp lạnh phòng điều khiển/điện; thông gió cưỡng bức khu thiết bị; giữ áp dương phòng điện chống bụi; lọc khí.
- **Thiết bị:** Chiller, AHU/FCU, quạt thông gió, damper, lọc, cảm biến.
- **Instrument:** Nhiệt/độ ẩm phòng, áp chênh phòng điện, trạng thái AHU/chiller, lọc chênh áp.
- **PLC/DCS:** BOP (HVAC control).
- **Interlock/Trip:** Nhiệt phòng DCS/điện cao → tăng lạnh/báo (bảo vệ thiết bị); xả khí chữa cháy → dừng HVAC vùng; lọc tắc → báo.
- **Alarm:** Nhiệt phòng điện/DCS cao (P2 bảo vệ thiết bị), chiller trip, áp phòng điện thấp (mất áp dương), lọc tắc.
- **Trend:** Nhiệt phòng DCS/điện, độ ẩm, áp chênh.
- **Faceplate:** HVAC (nhiệt/ẩm phòng, chiller/AHU chạy).
- **Tag:** breadth `10SA*` (nhiệt/ẩm/áp/AHU). [GIẢ ĐỊNH KKS]
- **Animation:** AHU chạy, luồng khí, nhiệt phòng.
- **Sequence:** — (điều hoà liên tục; lead/lag chiller).
- **SOP:** Giữ nhiệt phòng điện/DCS trong dải nhà chế tạo; duy trì áp dương phòng điện; thay lọc định kỳ.

---

# 7. BỐN MỤC CHUYÊN SÂU (bắt buộc — annex A §162–167)

## 7.1 Cause & Effect Matrix — MFT (Master Fuel Trip), NFPA 85
Hiện thực: `thermalCauseEffect` ma trận `boiler-MFT` (CauseEffectEngine, GĐ-47). Đánh giá mỗi bước trên CCS live; latch tới khi reset.

| Nguyên nhân (bất kỳ) | Hệ quả (đồng thời khi MFT) |
|---|---|
| Mất cả 2 ID fan | `BLR_MFT_TRIP` = 1 |
| Mất cả 2 FD fan | `BLR_MILLS_TRIP` = 1 (cắt toàn bộ mill) |
| Áp buồng lửa HH/LL | `BLR_FUEL_VALVES_CLOSE` = 1 (đóng dầu + than) |
| Mức bao hơi HH/LL (±250 mm) | `BLR_PA_FANS_TRIP` = 1 |
| Mất toàn bộ lửa (loss of all flame) | (cắt nhiên liệu → hơi/áp sập — GĐ-48) |
| Lưu lượng gió < 25% BMCR | |
| Mất toàn bộ nhiên liệu | |
| Turbine trip (unit trip) | |
| Trip bằng tay | |

Hệ quả vật lý (GĐ-48): MFT cắt than → hơi/áp sập → MW tụt theo hơi. `resetCauseEffect` chỉ thành công khi hết nguyên nhân, xoá flag → phục hồi (OTS: trip→reset→restart).

## 7.2 Turbine Trip Matrix
Hiện thực: `thermalCauseEffect` ma trận `turbine-trip` (3×2). Test kiểm inject loss-of-vacuum → chốt.

| Nguyên nhân (bất kỳ) | Hệ quả |
|---|---|
| Vượt tốc 110% (3300 rpm) | `TRB_TRIP` = 1 |
| Áp dầu bôi trơn thấp | `TRB_MSV_CLOSE` = 1 (đóng van chặn chính) |
| Chân không thấp (> 20 kPa [GIẢ ĐỊNH]) | (đóng draw → MW=0, áp lò tăng — GĐ-48) |
| Rung ổ trục cao · dịch trục cao · nhiệt ổ trục cao | |
| Generator protection trip | |
| MFT (unit trip) · trip tay | |

Cascade: turbine trip → đóng draw → áp lò tăng > 19,3 MPa → có thể kích MFT (GĐ-49).

## 7.3 Boiler Purge / Start-up Sequence — NFPA 85
Hiện thực: SFC `boiler-purge` + `light-off` (SequenceEngine, thermalSequences, GĐ-45). Thứ tự khởi động:

1. **ID fan** khởi động ĐẦU TIÊN → tạo áp âm buồng lửa.
2. **FD fan** khởi động → thiết lập lưu lượng gió purge.
3. **PA fan** khởi động.
4. **Purge permissive** (không nhiên liệu, gió ≥ 25% BMCR, van đóng…) → **purge ≥ 5 phút** (5× thể tích lò [GIẢ ĐỊNH]).
5. **Oil igniter** đưa vào → trial-for-ignition ≤ 10 s → xác nhận lửa (flame scanner).
6. **Mill** khởi động (PA sấy → feeder) → chuyển lửa than → rút oil khi ổn định.

Permissive-gate + timeout→failed do SequenceEngine thông dịch (không hardcode).

## 7.4 Generator Protection — mã ANSI
Danh mục bảo vệ máy phát (ECS, hiện thực ở mức danh mục breadth + turbine-trip C&E). Chi tiết relay = pha sau (GĐ-70).

| ANSI | Chức năng | Hệ quả |
|---|---|---|
| 87G | Differential máy phát | Trip máy phát + turbine (unit trip) |
| 87T | Differential máy biến áp (GSU/UAT) | Trip máy biến áp + máy cắt |
| 40 | Mất kích từ (loss of field) | Trip |
| 46 | Dòng thứ tự nghịch (unbalance) | Trip/báo |
| 32 | Công suất ngược (reverse power) | Trip (motoring) |
| 21 | Khoảng cách (distance, backup) | Trip có trễ |
| 51V | Quá dòng có kiềm áp | Backup trip |
| 59 / 27 | Quá áp / kém áp | Trip/báo |
| 81 O/U | Quá tần / kém tần | Trip/báo |
| 64F | Chạm đất rotor (field ground) | Báo/trip |
| 24 | Quá kích từ (V/Hz) | Giới hạn/trip |

Bất kỳ bảo vệ trip → generator protection trip → nằm trong nguyên nhân Turbine Trip Matrix (§7.2).

---

# 8. Ánh xạ nghiệm thu (§10 prompt cha)

| Tiêu chí §10 | Trạng thái |
|---|---|
| ≥ 40 hệ thống × 13 mục | ✔ **45 hệ** (tài liệu này) |
| ≥ 3.000 tag | ✔ 3.610 (registry, GĐ-42/44) |
| ≥ 600 alarm rationalize | ✔ 662 (GĐ-44) |
| ≥ 25 control loop | ✔ 29 (GĐ-44) |
| ≥ 8 sequence | ✔ 8 SFC (GĐ-45) |
| ≥ 70 màn hình | ✔ 87 catalog + 12 màn hệ thống + màn hình con hệ physics |
| C&E MFT + turbine trip | ✔ 2 ma trận (GĐ-47) |
| Kịch bản cold-start→coast-down | ✔ ScenarioRunner (GĐ-46) |

**Liên kết mô hình vật lý:** 12 mô hình sim (boiler · turbine/generator · reheat · feedwater · condenser/CW · flue-gas/air · emissions · electrical · cooling-tower · coal-handling · plant-balance · registry-sim) khép **cân bằng năng lượng ~100%** (PlantBalanceModel, GĐ-73). Các hệ đánh dấu "(breadth)" có tag danh mục sống (RegistrySimModel, GĐ-61) — mô hình vật lý riêng cho từng hệ BoP còn lại = pha sau.

## Còn mở (đăng ký doc 25)
- **M-02:** đối chiếu KKS breadth ↔ VGB-B 106 (mọi mã `[GIẢ ĐỊNH]` trong tài liệu này).
- **M-03:** xác nhận FGD (§6.20) với chủ đầu tư.
- **M-06:** calibrate enthalpy chu trình → hiệu suất net khớp 39% (GĐ-73).
- Mô hình vật lý riêng cho các hệ "(breadth)" (soot blower, fuel oil, PA fan, bypass, switchyard, DG, UPS, DM, dosing, air, fire, HVAC) — hiện là tag danh mục sống, chưa physics riêng.
