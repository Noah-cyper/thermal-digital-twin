# 06‑04 — FD / ID / PA Fans (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2 (FD/ID/PA 2×50%). C&E → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | FD cấp gió cháy (secondary air); ID hút khói giữ draft; PA cấp gió sấy + tải bột than |
| 2 | **Nguyên lý** | Mỗi loại **2 × 50%**; balanced draft: FD đẩy + ID hút phối hợp giữ **furnace −50 Pa**; điều tiết qua inlet guide vane / damper |
| 3 | **Thiết bị** | FD fan 2×50%, ID fan 2×50%, PA fan 2×50%, inlet guide vanes, motor |
| 4 | **Instrument** | Fan flow, vane position, motor current, bearing vib/temp, discharge pressure |
| 5 | **PLC/DCS** | Combustion / furnace draft control — Boiler Island |
| 6 | **Interlock/Trip** | **Mất cả 2 ID → MFT**; **mất cả 2 FD → MFT**; air flow < 25% BMCR → MFT; bearing vib HH → fan trip; **fan trip → runback** (C&E doc 09) |
| 7 | **Alarm** | `BLR-IDA-BRG-VIB-HH` P1 · `BLR-FDA-BRG-TEMP-HH` P2 · `BLR-PAA-CURRENT-HH` P2 · fan trip P1 |
| 8 | **Trend** | fan flow, vane position, motor current, bearing vib/temp, furnace draft |
| 9 | **Faceplate** | Fan start/stop + vane control + permissive + lý do bị chặn |
| 10 | **Tag** | `BLR_FD_A_FLOW_01` · `BLR_ID_A_VANE_01` (%) · `BLR_PA_A_CURRENT_01` (A) · `BLR_ID_A_BRG_VIB_01` (mm/s) |
| 11 | **Animation** | Fan quay khi chạy; vane mở theo %; fan **đỏ khi trip**; đường gió/khói chảy |
| 12 | **Sequence** | Khởi động **ID → FD → PA** (tạo draft trước); trip 1 fan → runback bằng fan còn lại |
| 13 | **SOP** | Khởi ID trước để lập draft; giữ furnace −50 Pa; theo dõi vib/temp ổ trục |

**Số vận hành định mức:** FD/ID/PA đều 2 × 50% · furnace draft −50 Pa · air flow trip < 25% BMCR.
