# 25 — Assumptions & Open Issues

> Tài liệu #25/00–25 (§14). Sổ đăng ký `[GIẢ ĐỊNH]` + vấn đề mở — cập nhật liên tục. Mọi số ngoài
> Design Basis đều nằm ở đây.

## 1. Sổ giả định (GĐ‑01 … GĐ‑31)
| Mã | Nội dung | Nguồn |
|---|---|---|
| GĐ‑01 | Hệ số tăng tốc AI 1,8–2,5× | doc 00 |
| GĐ‑02 | Person‑month theo tầng (bottom‑up) | doc 00 |
| GĐ‑03 | §10 ≈ 2,5–3 năm → 12 tuần = lát cắt kiến trúc; 3 malfunction W12 (mill trip·tube leak·loss of vacuum) | doc 00 |
| GĐ‑04 | Mã KKS chi tiết (trừ 10LAB10CP001) chờ đối chiếu VGB‑B 106 | doc 01/04/07 |
| GĐ‑05 | Redis current value + pub/sub | doc 02 |
| GĐ‑06 | Video wall dùng chung image hmi | doc 02 |
| GĐ‑07 | Hằng số area=0,8 ví dụ TankLevelModel | doc 03 |
| GĐ‑08 | Enum `requires.engines` (11 engine) | doc 03 |
| GĐ‑09 | SvgPrimitive 4 kind | doc 03 |
| GĐ‑10 | retention_class 3 lớp | doc 04 |
| GĐ‑11 | security_level số nguyên | doc 04 |
| GĐ‑12 | Tag/instance theo template | doc 07 |
| GĐ‑13 | Roll‑up ~3.600 tag | doc 07 |
| GĐ‑14 | Phân bố scan class 15/50/25/10% | doc 07 |
| GĐ‑15 | Alarm/instance theo template | doc 08 |
| GĐ‑16 | Roll‑up ~650 alarm | doc 08 |
| GĐ‑17 | 30 loop; PID params ở doc 10 | doc 09 |
| GĐ‑18 | Thời gian purge & % air NFPA 85 (nguyên tắc) | doc 09 |
| GĐ‑19 | τ/θ các vòng | doc 10 |
| GĐ‑20 | K_swell, hằng số bơm/quạt | doc 10 |
| GĐ‑21 | PID params khởi điểm | doc 10 |
| GĐ‑22 | Số D3 ~52 | doc 12 |
| GĐ‑23 | Hotkey số D2/S | doc 13 |
| GĐ‑24 | ~40 symbol | doc 14 |
| GĐ‑25 | Prisma vs TypeORM | doc 15 |
| GĐ‑26 | device_id chi tiết BoP | doc 16 |
| GĐ‑27 | Endpoint schema sinh từ Zod | doc 17 |
| GĐ‑28 | Sơ đồ zone/conduit theo hạ tầng | doc 18 |
| GĐ‑29 | Danh mục KPI mở rộng | doc 21 |
| GĐ‑30 | Ngưỡng coverage 70% | doc 22 |
| GĐ‑31 | Turborepo vs Nx | doc 23 |
| GĐ‑32 | Hằng số hiệu chỉnh sim Boiler Island (Pha B): DH_EVAP=2758 kJ/kg (coal ~280→steam BMCR 2008), ETA_COMB_MAX=0,94, K_O2_PENALTY=0,01, AF_STOICH=10 kg/kg, AIR_MAX=4000 t/h, K_PRESS=2e‑5, K_SWELL_P=8000, TAU_COAL_ACT=8 s, đường cong SH temp (505+80·tải−95·spray), K_DRAFT=5 Pa/%, MW_PER_TPH=600/2008 (turbine đơn giản hoá) | doc 10 |
| GĐ‑33 | Biên nhiễu đo seeded (LCG, không Math.random): level 0,4 mm · press 0,02 MPa · temp 0,5 °C · O₂ 0,03% · flow 2 t/h · coal 1 t/h · furnace 3 Pa · MW 0,5 | doc 10 §8 |
| GĐ‑34 | Tuning CCS Pha B: gain loop giảm từ doc 10 §9 cho ổn định (pressure kp2/ki0,03 · governor kp3/ki0,3 · fuel kp0,3/ki0,2); FF coordinated (DRAW_TO_FIRING=100/2008 · FIRING_TO_COAL=3 · FIRING_TO_AIR=0,83 · STEAM_TO_FWCV=100/2100); warm-start điểm vận hành ~448 MW | doc 09/10 |
| GĐ‑35 | Setpoint alarm Boiler Island ngoài Design Basis: MSTM-PRESS-HH 19,3 MPa · PRESS-LO 16,0 · SH-TEMP-HH 551 °C · FLUE-O2-LO 1,5% (drum ±250, furnace ±200 neo Design Basis §3.2) | doc 08 |

## 2. Vấn đề mở
| # | Vấn đề | Cần |
|---|---|---|
| M‑01 | Hiệu chỉnh GĐ‑02 (person‑month) bằng velocity thực Pha A | đo khi code |
| M‑02 | Đối chiếu toàn bộ KKS với VGB‑B 106 | tài liệu chuẩn |
| M‑03 | Xác nhận có FGD hay không (doc 06‑39) | chủ đầu tư |
| M‑04 | Tuning PID + τ/θ trên sim thực | pha code |
| M‑05 | Mốc chuyển lát cắt → v1‑complete | lập lịch doc 24 |

## 3. Chống bịa
Mọi số không có trong Design Basis đã gắn `[GIẢ ĐỊNH]` và đăng ký ở đây. Không trích số điều khoản
tiêu chuẩn khi không chắc — mô tả nguyên tắc.
