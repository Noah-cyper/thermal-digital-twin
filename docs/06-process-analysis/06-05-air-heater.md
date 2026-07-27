# 06‑05 — Air Heater (Boiler Island)

> 13 mục §10. Neo Design Basis §3.2 (2 × regenerative Ljungström). C&E → doc 09.

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Thu hồi nhiệt khói gia nhiệt gió (PA + SA) trước khi vào lò → tăng hiệu suất |
| 2 | **Nguyên lý** | Regenerative rotary (**Ljungström**): rotor quay mang nhiệt từ dòng khói sang dòng gió; **2 air heater** |
| 3 | **Thiết bị** | Rotor + drive motor, seals, soot blower, fire detection/wash |
| 4 | **Instrument** | Gas in/out temp, air in/out temp, rotor speed, ΔP gas/air, motor current |
| 5 | **PLC/DCS** | Boiler Island |
| 6 | **Interlock/Trip** | **Rotor stall (motor fail) → alarm + nguy cơ tắc/cháy**; fire detected → wash/CO₂; không MFT trực tiếp |
| 7 | **Alarm** | `BLR-AHA-ROTOR-STALL` P1 · gas‑out temp **HH** (nguy cơ cháy) P1 · gas‑out temp **LO** (acid dew point ăn mòn) P2 · ΔP high P2 |
| 8 | **Trend** | gas in/out temp, air out temp, rotor speed, ΔP |
| 9 | **Faceplate** | Rotor status + soot blowing |
| 10 | **Tag** | `BLR_AH_A_GASOUT_TEMP_01` (°C) · `BLR_AH_A_AIROUT_TEMP_01` · `BLR_AH_A_ROTOR_SPD_01` (rpm) · `BLR_AH_A_DP_01` |
| 11 | **Animation** | Rotor quay; nhiệt độ gas/air; ΔP tăng khi tắc |
| 12 | **Sequence** | Start rotor **trước** khi có khói nóng; soot blowing định kỳ |
| 13 | **SOP** | Tránh gas‑out temp thấp (ăn mòn acid dew point); soot blow định kỳ; giám sát rotor liên tục |

**Số vận hành định mức:** 2 × Ljungström regenerative · gia nhiệt PA + SA.
