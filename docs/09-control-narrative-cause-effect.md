# 09 — Control Narrative & Cause‑Effect

> Tài liệu #09/00–25 (§14). Nguồn: doc 06 (phân tích hệ) + Phụ lục A §6/§8. PID engine: doc 05‑06.
> Chốt: **≥ 25 control loop · C&E matrix MFT · Turbine Trip Matrix · Generator protection ANSI ·
> NFPA 85 purge**. Interlock là first‑class object, hiển thị lý do bị chặn (doc 05‑06).

## 1. Danh mục control loop (≥ 25)
| # | Loop | PV | MV (OP) | Mode |
|---|---|---|---|---|
| 1 | Boiler master | MW/steam demand | fuel+air demand | AUTO/CCS |
| 2 | Fuel master | fuel demand | tổng coal/oil flow | CASCADE |
| 3 | Air flow / O₂ trim | O₂ (3,2%) | FD damper/SA | CASCADE |
| 4 | Furnace draft | furnace −50 Pa | ID guide vane | AUTO |
| 5 | Drum level 3‑element | drum level 0 mm | FW control valve | CASCADE |
| 6 | Feedwater / BFP speed | FW flow | BFP speed | CASCADE |
| 7 | Main steam pressure | 17,5 MPa | boiler/turbine demand | CCS |
| 8 | SH temp (spray) | 541 °C | SH spray valve | CASCADE |
| 9 | RH temp | 541 °C | RH spray/tilt | AUTO |
| 10 | Turbine governor | speed/load, droop 4–5% | governor valve | AUTO |
| 11 | Deaerator level | DA level | make‑up/CV | AUTO |
| 12 | Deaerator pressure | 0,9 MPa | pegging steam | AUTO |
| 13 | Condenser hotwell level | hotwell level | CEP recirc/CV | AUTO |
| 14 | Condenser vacuum | 5,4 kPa | vacuum pump | AUTO |
| 15 | PA flow (per mill A–F) | PA flow | PA damper | AUTO |
| 16 | Mill outlet temp (A–F) | outlet temp | cold air damper | AUTO |
| 17 | Aux steam header | header pressure | PRDS valve | AUTO |
| 18 | Gland steam header | header pressure | gland CV | AUTO |
| 19 | HP heater level (×3) | heater level | drain valve | AUTO |
| 20 | LP heater level (×4) | heater level | drain valve | AUTO |
| 21 | Generator AVR | terminal voltage/Q | excitation | AUTO |
| 22 | Economizer recirc | flow | recirc valve | AUTO (start) |
| 23 | Cooling tower basin | basin level | make‑up valve | AUTO |
| 24 | DM tank level | tank level | DM feed | AUTO |
| 25 | Chemical dosing | pH / dissolved O₂ | dosing pump | AUTO |
| 26 | Fuel oil pressure | FO pressure | FO recirc/CV | AUTO |
| 27 | Fuel oil temp | FO temp (nhớt) | FO heater | AUTO |
| 28 | Instrument air pressure | IA header | compressor/unload | AUTO |
| 29 | CCW supply temp | CCW temp | CW to HX valve | AUTO |
| 30 | Turbine bypass | steam pressure | HP/LP bypass | AUTO (start/trip) |

→ **≥ 25 ✓** (30 loop). Chi tiết PID params (kp/ki/kd) → doc 10.

## 2. CCS — Coordinated Control (3 mode)
| Mode | Boiler | Turbine | Dùng khi |
|---|---|---|---|
| **Boiler‑follow** | theo áp | dẫn tải (governor) | đáp ứng tải nhanh, áp dao động |
| **Turbine‑follow** | dẫn (fuel) | giữ áp | ổn định áp, đáp ứng tải chậm |
| **Coordinated** | phối hợp | phối hợp | vận hành bình thường — cân bằng cả hai |

## 3. Cause & Effect Matrix — MFT (Master Fuel Trip)
Nguyên nhân (hàng) × Hậu quả (cột). ✓ = kích hoạt.

| Nguyên nhân \ Hậu quả | MFT | Trip all mill | Close FO trip valve | Trip igniter | Turbine trip | Post‑MFT purge | P1 + first‑out |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Mất cả 2 ID fan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mất cả 2 FD fan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Furnace pressure HH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Furnace pressure LL | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Drum level HH (+250) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Drum level LL (−250) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Loss of all flame | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Air flow < 25% BMCR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Loss of all fuel | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Turbine trip (unit) | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Manual trip | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 4. Turbine Trip Matrix
| Nguyên nhân \ Hậu quả | Trip turbine | Đóng MSV/GV/RSV/IV | Trip generator | MFT (unit) | AOP/EOP start | Turning gear |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Overspeed 110% | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lube oil pressure LO | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vacuum LO | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bearing vibration HH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Axial displacement HH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bearing temp HH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Generator protection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| MFT | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Manual trip | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 5. Generator Protection (mã ANSI)
| Mã | Bảo vệ | | Mã | Bảo vệ |
|---|---|---|---|---|
| 87G | Differential máy phát | | 59 | Overvoltage |
| 87T | Differential máy biến áp | | 27 | Undervoltage |
| 40 | Loss of field | | 81O/U | Over/Under frequency |
| 46 | Negative sequence | | 64F | Field ground |
| 32 | Reverse power | | 24 | Overexcitation (V/Hz) |
| 21 | Distance | | 51V | Voltage‑restrained overcurrent |

## 6. NFPA 85 — Purge / Start‑up Sequence
| Bước | Điều kiện / hành động |
|---|---|
| Purge permissive | mọi fuel valve đóng · air flow ≥ 25% BMCR · không có flame · dampers đúng vị trí |
| Purge | duy trì air flow ≥ 25% BMCR trong **≥ 5 lần thể tích buồng lửa / thời gian purge** |
| MFT reset | chỉ sau khi purge hoàn tất & hết nguyên nhân trip |
| Light‑off | thứ tự **ID → FD → PA → oil igniter → mill** |
| Ramp | tăng tải theo CCS, chuyển 1→3‑element drum level khi tải > ~20% |

## 7. Nguyên tắc interlock/permissive
- **Permissive** = điều kiện AND/OR cho phép *start*; **Interlock** = chặn khi đang chạy; **Trip** = dừng khẩn.
- First‑class object (doc 05‑06): hiển thị **lý do bị chặn** ("Start blocked: seal air low").
- Mọi lệnh ghi: audit + xác nhận 2 bước (doc 05‑07).

## 8. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑17 | Danh sách 30 loop (§1) — kp/ki/kd chi tiết ở doc 10 |
| GĐ‑18 | Thời gian purge cụ thể & % air flow theo NFPA 85 (nguyên tắc; số điều khoản không trích nếu không chắc) |
