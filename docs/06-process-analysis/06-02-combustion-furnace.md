# 06‑02 — Combustion / Furnace (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2. NFPA 85. C&E MFT → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Đốt than tạo nhiệt, truyền bức xạ cho waterwall; duy trì áp buồng lửa & tỉ lệ khí‑nhiên liệu |
| 2 | **Nguyên lý** | Balanced draft (FD đẩy, ID hút) giữ **furnace −50 Pa**; PA tải bột than + SA cấp gió cháy; **O₂ 3,2%** sau economizer; air/fuel + O₂ trim |
| 3 | **Thiết bị** | Waterwall, burners (tangential), oil igniters, windbox, dampers SA/PA |
| 4 | **Instrument** | Furnace draft PT (−200…+200 Pa), O₂ analyzer, flame scanner mỗi burner, PA/SA flow, coal flow |
| 5 | **PLC/DCS** | BMS (NFPA 85) + Combustion control — Boiler Island |
| 6 | **Interlock/Trip** | **Loss of all flame → MFT**; furnace pressure **HH/LL → MFT**; **air flow < 25% BMCR → MFT**; mất cả 2 FD hoặc 2 ID → MFT (C&E doc 09) |
| 7 | **Alarm** | `BLR-FURN-PRESS-HH/LL` P1 · `BLR-O2-LO/HI` P2 · `BLR-FLAME-LOSS` P1 · air flow low P2 |
| 8 | **Trend** | furnace draft, O₂, PA/SA flow, coal flow, MW (so tương quan cháy) |
| 9 | **Faceplate** | Furnace draft control (ID) · O₂ trim · air/fuel ratio |
| 10 | **Tag** | `BLR_FURN_PRESS_01` (Pa) · `BLR_O2_01` (%) · `BLR_PA_FLOW_01` · `BLR_SA_FLOW_01` · `BLR_COAL_FLOW_01` (t/h) |
| 11 | **Animation** | Flame on/off từng burner; giá trị draft; đường gió/khói chảy theo lưu lượng |
| 12 | **Sequence** | **NFPA 85 purge**: air ≥ 25% BMCR, ≥ 5 lần thể tích / thời gian purge → cho phép igniter → burner (thứ tự ID→FD→PA→oil→mill) |
| 13 | **SOP** | Purge bắt buộc trước light‑off; giữ O₂ 3,2% & draft −50 Pa; không mồi khi chưa đủ purge |

**Số vận hành định mức:** furnace −50 Pa (dải −200…+200) · O₂ 3,2% · quạt FD/ID/PA 2×50% · than LHV 21.500 kJ/kg.
