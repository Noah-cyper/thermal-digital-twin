# 06‑06 — Economizer (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2 (FW ra economizer 283 °C). C&E → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Thu hồi nhiệt khói gia nhiệt **nước cấp** trước khi vào drum → giảm heat rate |
| 2 | **Nguyên lý** | Bank ống nước cấp đặt trong đường khói sau SH/RH; nước cấp ra **283 °C** về drum |
| 3 | **Thiết bị** | Economizer coil bank, inlet/outlet headers, **recirculation line** (khởi động) |
| 4 | **Instrument** | FW inlet/outlet temp, flue gas temp, feedwater flow |
| 5 | **PLC/DCS** | Boiler Island |
| 6 | **Interlock/Trip** | No‑flow khi khởi động → **recirculation** (chống steaming); low FW flow → alarm (không MFT trực tiếp) |
| 7 | **Alarm** | `BLR-ECO-FWOUT-TEMP-HH` P2 · `BLR-FW-FLOW-LO` P2 · gas‑out temp HH P3 |
| 8 | **Trend** | FW inlet/outlet temp, flue gas temp, feedwater flow |
| 9 | **Faceplate** | Economizer temps + recirc valve |
| 10 | **Tag** | `BLR_ECO_FWOUT_TEMP_01` (°C, ~283) · `BLR_ECO_GASOUT_TEMP_01` · `BLR_FW_FLOW_01` (t/h) |
| 11 | **Animation** | Nhiệt độ nước tăng dọc bank; đường nước cấp (xanh) / khói (nâu) chảy |
| 12 | **Sequence** | **Recirculation** khi khởi động (đảm bảo flow trước khi cấp nhiệt, tránh steaming) |
| 13 | **SOP** | Có flow trước khi cấp nhiệt; theo dõi outlet temp; mở recirc khi tải thấp |

**Số vận hành định mức:** FW ra economizer 283 °C · O₂ sau economizer 3,2%.
