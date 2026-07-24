# 06 — Process Analysis (Phân tích quy trình) — Index

> Tài liệu #06/00–25 (§10 prompt cha). **Tách theo hệ thống** (một file/hệ), mỗi hệ đủ **13 mục**.
> Neo Design Basis (Phụ lục A §3). Naming theo doc 04. **C&E matrix MFT/Turbine trip → doc 09**.
> **Trạng thái: 41 hệ đã phân tích (≥ 40 ✓).**

## Khung 13 mục/hệ (§10)
Chức năng · Nguyên lý · Thiết bị · Instrument · PLC/DCS thuộc hệ · Interlock/Trip · Alarm · Trend ·
Faceplate · Tag · Animation · Sequence · SOP.

## Danh mục hệ thống (41)

### Boiler Island (vertical slice — 12 tuần)
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-01-steam-drum.md` | Steam Drum | **Xong** |
| `06-02-combustion-furnace.md` | Combustion / Furnace | **Xong** |
| `06-03-pulverizer.md` | Pulverizer (Mill A–F) | **Xong** |
| `06-04-fans-fd-id-pa.md` | FD / ID / PA Fans | **Xong** |
| `06-05-air-heater.md` | Air Heater | **Xong** |
| `06-06-economizer.md` | Economizer | **Xong** |
| `06-07-main-steam.md` | Main Steam (SH) | **Xong** |
| `06-08-steam-temp-control.md` | SH/RH Temp Control | **Xong** |
| `06-09-boiler-protection.md` | Boiler Protection (MFT) | **Xong** |
| `06-43-soot-blower.md` | Soot Blower | **Xong** |

### Turbine Island & Steam/Water Cycle
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-20-turbine.md` | Turbine HP/IP/LP | **Xong** |
| `06-23-condenser.md` | Condenser | **Xong** |
| `06-24-condensate-system.md` | Condensate / CEP | **Xong** |
| `06-25-feedwater-bfp.md` | Feedwater / BFP | **Xong** |
| `06-26-deaerator.md` | Deaerator | **Xong** |
| `06-27-hp-heaters.md` | HP Heaters | **Xong** |
| `06-28-lp-heaters.md` | LP Heaters | **Xong** |
| `06-31-turbine-bypass.md` | Turbine Bypass | **Xong** |
| `06-32-gland-seal-steam.md` | Gland / Seal Steam | **Xong** |
| `06-33-turbine-lube-oil.md` | Turbine Lube Oil | **Xong** |
| `06-34-auxiliary-steam.md` | Auxiliary Steam | **Xong** |
| `06-35-closed-cooling-water.md` | Closed Cooling Water | **Xong** |

### Generator & Electrical
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-21-generator.md` | Generator + Excitation | **Xong** |
| `06-22-electrical-single-line.md` | Electrical Single Line | **Xong** |
| `06-36-switchyard-500kv.md` | Switchyard 500 kV | **Xong** |
| `06-50-diesel-generator.md` | Emergency Diesel Generator | **Xong** |
| `06-51-ups-battery.md` | UPS & Battery (DC) | **Xong** |

### Cooling Water
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-29-cooling-water.md` | Cooling Water (CW) | **Xong** |
| `06-30-cooling-tower.md` | Cooling Tower | **Xong** |

### Flue Gas & Emission
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-37-esp.md` | ESP | **Xong** |
| `06-38-cems.md` | CEMS | **Xong** |
| `06-39-fgd.md` | FGD (nếu có) | **Xong** |
| `06-40-stack-flue-gas.md` | Stack & Flue Gas | **Xong** |

### Coal & Ash
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-41-coal-handling.md` | Coal Handling | **Xong** |
| `06-42-ash-handling.md` | Ash Handling | **Xong** |

### Balance of Plant (auxiliary)
| File | Hệ thống | Trạng thái |
|---|---|---|
| `06-44-fuel-oil.md` | Fuel Oil | **Xong** |
| `06-45-water-treatment.md` | Water Treatment (DM) | **Xong** |
| `06-46-chemical-dosing.md` | Chemical Dosing | **Xong** |
| `06-47-compressed-instrument-air.md` | Compressed & Instrument Air | **Xong** |
| `06-48-fire-fighting.md` | Fire Fighting | **Xong** |
| `06-49-hvac.md` | HVAC | **Xong** |

## Nghiệm thu (§10)
- **≥ 40 hệ:** 41 ✓
- **≥ 3.000 tag · ≥ 600 alarm · ≥ 25 loop · ≥ 8 sequence:** tổng hợp & chốt ở **doc 07** (tag registry),
  **doc 08** (alarm), **doc 09** (control/C&E) — doc 06 là nguồn phân tích đầu vào.
