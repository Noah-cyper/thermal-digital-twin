# 07 — Tag Standard & Registry

> Tài liệu #07/00–25 (§14). Bản ghi tag 20 trường & ánh xạ KKS/UNS: **doc 04** (không lặp).
> Đây chốt: **chuẩn scan/EU/deadband · template tag theo loại thiết bị · roll‑up ≥ 3.000 tag · cách
> sinh YAML**. Registry vật lý = template × instance → seed (script ở pha code). Nguồn phân tích: doc 06.

## 1. Chuẩn đặt tên & bản ghi
- Naming: **KKS** (VGB‑B 106) + fallback `AREA_SYS_EQUIP_MEAS_NN` (doc 04). KKS chưa chắc → `[GIẢ ĐỊNH]`.
- Bản ghi 20 trường (doc 04 §6): `id·kks·uns·name·desc_vi/en·datatype·eu·range·deadband·scan_class·
  quality·source·asset_id·alarm_ids·retention_class·security_level·is_writable·sim_model_ref`.
- Khoá tham chiếu = **tag id (UUID)**; KKS/UNS/Sparkplug là attribute.

## 2. Gán scan class (§9)
| Loại đo | Scan class | Chu kỳ |
|---|---|---|
| Tốc độ, rung, trip, flame | **fast** | 250 ms |
| Lưu lượng, áp, mức, PV/SP/OP điều khiển | **process** | 500 ms |
| Nhiệt độ ổ trục/cuộn dây, giờ chạy | **slow** | 1 s |
| Chẩn đoán, network health, analyzer | **diag** | 5 s |

Phân bố `[GIẢ ĐỊNH]`: fast ~15% · process ~50% · slow ~25% · diag ~10%.

## 3. Template tag theo loại thiết bị (số tag/instance)
Chi tiết YAML: `docs/07-tag-registry/templates.tags.yaml`.

| Loại | Tag chuẩn | tag/instance |
|---|---|---:|
| Motor pump / fan | RUN·MODE·CURRENT·FLOW·DISCH_PRESS·BRG_VIB·BRG_TEMP_DE/NDE·WIND_TEMP·TRIP | 10 |
| Mill | + OUTLET_TEMP·PA_FLOW·FEEDER_SPD·DP·SEAL_AIR | 12 |
| Control loop / valve | PV·SP·OP·MODE·POS_FB·OPEN·CLOSE·FAULT | 8 |
| Transmitter (PT/TT/FT/LT) | PV·QUALITY·ALM | 3 |
| Analyzer (O₂/CEMS) | VALUE·QUALITY·CAL·RANGE·FAULT | 5 |
| Breaker | STATUS·CURRENT·VOLTAGE·PROT·TRIP | 5 |
| Heater / vessel | LEVEL·DRAIN·IN_TEMP·OUT_TEMP·BYPASS·ALM | 6 |

## 4. Roll‑up số tag theo khu vực (≥ 3.000) `[GIẢ ĐỊNH]`
Ước lượng = số instance (từ doc 06) × tag/instance.

| Khu vực | Thiết bị/điểm chính | ~tag |
|---|---:|---:|
| Boiler Island | 6 mill·6 fan·burners·drum·SH/RH·econ·AH·protection | 620 |
| Turbine Island | turbine·condenser·CEP·BFP·DA·HP/LP heater·bypass·lube oil·CCW | 480 |
| Generator + Excitation | stator/rotor·AVR·H₂ | 180 |
| Electrical (bus/UAT/GSU/MCC) | buses·transformers·~20 breaker | 520 |
| Switchyard 500 kV | bays·breaker·disconnector·CT/VT | 240 |
| Cooling Water + Tower | CW pump·tower | 90 |
| Flue Gas / Emission | ESP·CEMS·FGD·stack | 260 |
| Coal Handling | conveyor·crusher·bunker | 300 |
| Ash Handling | hopper·silo·conveying | 150 |
| BoP (fuel oil·WTP·dosing·air·fire·HVAC·diesel·UPS) | | 560 |
| Calc/KPI/system/derived | heat rate·aux power·health | 200 |
| **TỔNG** | | **~3.600** |

→ **≥ 3.000 ✓** (nghiệm thu §10). Mục tiêu plugin đầy đủ = **15.000** (§9) — mở rộng bằng tăng
instance & điểm chi tiết, không đổi template.

> **Seed thực (đã code):** `SeedGenerator` (@idtp/engines) expand `thermalSeedSpec` (plugin) →
> **3.522 tag** (khớp roll-up trên) — kiểm bằng `plugins/thermal-power-600/test/seed.test.ts`. Con số
> chốt lại của GĐ‑13. Chi tiết: GĐ‑42 (doc 25).

## 4.1 Neo tag BoP vào hiện thực (trung thực docs↔code)
Roll‑up §4 (BoP 560 · Switchyard 240 · Ash 150) là DANH MỤC đầy đủ theo template × instance, hiện thực qua
**seed** (GĐ‑42: 3.522 tag). Song song, lớp **mô hình sim** (§13 doc 10) phơi bộ tag **hệ thống** BoP "sống"
— các tag SCADA/dashboard đọc trực tiếp, ĐÃ có physics riêng (khác placeholder breadth GĐ‑61):

| Model (`thermal‑…`) | Tiền tố tag | ~tag | GĐ |
|---|---|:--:|---|
| compressed‑air | `CA_*` | 8 | GĐ‑89 |
| fuel‑oil | `FO_*` | 6 | GĐ‑90 |
| ash‑handling | `ASH_*` | 9 | GĐ‑91 |
| soot‑blower | `SB_*` | 9 | GĐ‑95 |
| water‑treatment | `WT_*` | 9 | GĐ‑99 |
| emergency‑power | `EDG_*` / `UPS_*` | 11 | GĐ‑100 |
| switchyard | `SY_*` | 10 | GĐ‑101 |
| hvac | `HVAC_*` | 8 | GĐ‑102 |
| fire‑fighting | `FIRE_*` | 8 | GĐ‑103 |
| chemical‑dosing | `CHEM_*` | 8 | GĐ‑104 |

> **~86 tag hệ thống BoP** (tất định, EU theo §6, không `Math.random`). KKS chi tiết từng tag = `[GIẢ ĐỊNH]`
> chờ đối chiếu VGB‑B 106 (GĐ‑04 / M‑02); tên hiện dùng fallback `AREA_SYS_EQUIP_MEAS_NN`. Chi tiết vật lý mỗi
> model = sổ GĐ doc 25 (bảng này chỉ INDEX).

## 5. Cách sinh registry (YAML)
1. `templates.tags.yaml` — tag chuẩn theo loại thiết bị.
2. Danh sách instance theo asset (doc 04 asset model) — mỗi asset gắn `type`.
3. Seed: với mỗi instance, sinh tag `{fallback = AREA_SYS_EQUIP_SUFFIX_NN}`, `uns` theo asset, gán
   scan_class/EU/deadband/alarm theo template → xuất YAML per system.
4. Mẫu đã sinh: `docs/07-tag-registry/boiler-island.sample.tags.yaml`.

> Seed script chạy ở **pha code** (sau doc 24); doc 07 chốt chuẩn + template + mẫu (được phép: YAML/schema).
> **Đã hiện thực (pha code):** template `packages/sdk` (`TagTemplate`/`InstanceGroup`/`PlantSeedSpec`),
> expander generic `packages/engines/seed-generator.ts` (`generateRegistry`), dữ liệu thermal
> `plugins/thermal-power-600/src/seed/` (templates.ts ↔ templates.tags.yaml, spec.ts = 47 nhóm instance).

## 6. Quy ước EU & deadband
- EU chuẩn: MPa·kPa·°C·t/h·m³/h·mm·%·A·kV·mm/s·µS/cm·mg/Nm³·ppb.
- Deadband mặc định 1% dải (doc 05‑01); riêng mức/áp quan trọng đặt theo giá trị (vd drum 5 mm).

## 7. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑12 | Số tag/instance theo template (bảng §3) |
| GĐ‑13 | Roll‑up ~3.600 tag (bảng §4) — hiệu chỉnh khi seed thực |
| GĐ‑14 | Phân bố scan class 15/50/25/10% |
