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
| GĐ‑36 | Auth lát cắt đơn giản hoá: token dạng chuỗi (TTL 15' + refresh xoay) thay JWT ký thật; 6 user demo mật khẩu 'p'; auto-login Operator; leak/mill-trip (OTS) ánh xạ action 'override'. JWT/SSO/LDAP thật ở sau | doc 05-07/18 |
| GĐ‑37 | Số liệu plugin #2 water-treatment-demo là DEMO tổng hợp: FEED_MAX 200 m³/h · surge tank 60 m³ · SP mức 60% · setpoint alarm (LL10/LO25/HI80/HH90). Mục đích = bài test generic, không phải plant thật | doc 00 §5.4 |
| GĐ‑38 | OTS loss-of-vacuum: mục tiêu 30 kPa (τ 10 s), hệ số công suất = clamp(1−(vac−5,4)/40, 0,5..1) — chân không danh định 5,4 kPa là Design Basis §3.3 | doc 05-05/10 |
| GĐ‑39 | KPI v1: aux power cố định 7% (net = gross×0,93, theo Design Basis §3.1 558/600) — chưa đo house load; KPI tính trên toàn dải historian đã ghi (shift/daily report là v2, doc 21 §3) | doc 21 |
| GĐ‑40 | Maintenance: ngưỡng PM (UNIT1 8000h · MILL 2000h · BFP 4000h); run-state suy từ tag>ngưỡng (MW/coal/fw >10); MTBF = giờ chạy/số hỏng, event hỏng lấy alarm P1 của UNIT1 (v1 đơn giản hoá; CMMS thật = v3) | doc 05-18 |
| GĐ‑41 | Faceplate: interlock blockedReason = null (mô hình interlock first-class để pha sau); lý do chặn LỆNH vẫn hiện đủ qua Control/Security (RBAC/replay/2-step). KKS SH temp 10LBA10CT001 thuộc GĐ-04 (chờ đối chiếu VGB-B 106) | doc 05-15 |
| GĐ‑42 | Seed registry §10 (SeedGenerator + thermalSeedSpec): roll-up thực **3.522 tag / 651 alarm** (≥ 3.000/≥ 600 ✓, khớp bảng doc 07 §4 & ~650 doc 08 §4 — hiệu chỉnh GĐ‑13/16). Phân bố scan_class thực fast 12% / process 56% / slow 14% / diag 18% (lệch GĐ‑14 15/50/25/10 do CEMS+calc dồn diag). KKS breadth = [GIẢ ĐỊNH] có cấu trúc `<unit><sys><nn><mã><seq>` (GĐ‑04). `source='opcua'` = đường thu thập hiện trường bản thật; v1 chỉ mô phỏng lõi Boiler Island (17 tag sim). Registry là DANH MỤC (catalog): Alarm/Tag Engine live chạy subset rationalized, không nạp cả 3.522 tag. id = UUID tất định (cyrb53→splitmix, không Math.random) | doc 07 §5 / doc 08 |
| GĐ‑55 | UI Re-simulation banner cam (v1.8, doc 05-05 §4): server lệnh `resim` (read-only) chạy `reSimulate` nhánh what-if (malfunction hoặc override tải) → trả quỹ đạo; HMI 2 nút "What-if", overlay **banner cam** + biểu đồ canvas MW theo bước (500 bước, độc lập sim live). Không chặn khi replay (read-only, không đụng live) | doc 05-05 |
| GĐ‑54 | AI Advisor v1 rule-based (v1.7, doc 20): `AiAdvisor` READ-ONLY tuyệt đối (chỉ đọc alarm/tag/tri thức; KHÔNG ghi tag/setpoint/ACK). Giải thích alarm = hậu quả + nguyên nhân (theo điều kiện+ngưỡng) + khắc phục + LEO THANG (nếu tag là cause của ma trận C&E) + TRÍCH DẪN nguồn (SOP/narrative/cause-effect + tag + thời gian). Chống bịa: chỉ trích cái có thật. Tri thức plugin (`thermalKnowledge`: 4 doc SOP/C&E/narrative). Server lệnh `advise` (read-only, không chặn replay); HMI nút "💡 Giải thích" + panel. RAG/LLM thật = v2 | doc 20 |
| GĐ‑53 | Re-simulation what-if (v1.6, doc 05-05 §4): `reSimulate()` chạy NHÁNH mô phỏng ĐỘC LẬP — SimulationHost + ControlLoopEngine + kho tag riêng, khôi phục từ snapshot live, chạy kịch bản khác (override/malfunction) → quỹ đạo tag. Sim/tag LIVE KHÔNG bị đụng (kho tag riêng; chỉ đọc snapshot live). Loop nhánh khởi tạo AUTO (transient nhỏ; so sánh tương đối base↔nhánh để loại nhiễu). UI banner cam + biểu đồ quỹ đạo = pha sau (hiện là API + test) | doc 05-05 |
| GĐ‑52 | Driver MQTT Sparkplug B (v1.5, doc 16): `SparkplugDriver` (IProtocolDriver) vai trò HOST — nhận NBIRTH/NDATA, xử lý ĐÚNG alias (BIRTH lập name↔alias, DATA chỉ gửi alias), lọc theo interest → `ctx.publish` vào kernel; `write`→NCMD. `MqttTransport` + `SpCodec` INJECT → lõi không phụ thuộc mqtt.js/protobuf, kiểm được không cần broker. Serialize mặc định JSON; deploy dùng protobuf Eclipse Tahu. metricMap (name↔tag id) do cấu hình cấp | doc 16 |
| GĐ‑51 | Historian TimescaleDB + benchmark (v1.4, doc 19/24): `TimescaleHistorian` cùng chữ ký write/query — đạt mốc ghi **≥ 50.000 điểm/s** bằng write() ĐỆM đồng bộ + flush() BATCH (1 INSERT nhiều dòng). SQL qua `SqlExecutor` INJECT (deploy: node-postgres; test: executor giả) → lõi `@idtp/engines` KHÔNG phụ thuộc `pg`, kiểm được không cần DB. Benchmark loadgen (100k điểm tất định): Memory ~772k điểm/s, Timescale-đệm ~4,37M điểm/s (≫ 50k, biên rộng; throughput xuống DB thật đo tại triển khai). `docker-compose.yml` (Timescale 2.17-pg16) + `docs/benchmark.md`. Ngưỡng bucket/chu kỳ flush = [GIẢ ĐỊNH] | doc 19/24 |
| GĐ‑50 | OTS control UI (v1.3): server + HMI điều khiển OTS trực quan — nút chạy SFC "live" + panel Cause&Effect (trạng thái trip + Reset). RBAC: `seq-live-start` & `ce-reset` = action `engineer` (Engineer+, single-step) — cùng lớp OTS freeze; broadcast `seq-live`/`ce` report-by-exception, gửi `seq-list`/`ce` khi kết nối. (Chạy SFC là chức năng OTS/huấn luyện → gate Engineer, không thêm PermissionAction mới) | doc 05-07 |
| GĐ‑49 | SFC nối vào sim (v1.2, doc 09/10): sim đọc tag lệnh chuỗi → `BLR_FW_FILL_CMD` bơm điền lò (FILL_TPH=300 t/h [GIẢ ĐỊNH]) nâng mức; `BLR_MILL_A_STOP_CMD` bớt 1 mill công suất (mill-a-start xoá cờ). Runtime thêm đường chạy SFC "live" (tick theo nhịp sim, đồng hồ THẬT) để chuỗi tác động physics qua thời gian — khác runSequenceToCompletion (đồng hồ ảo, không bước sim). Ở điểm vận hành các tác động này nằm trong dải bù của CCS (đúng thực tế); kiểm chứng vật lý ở mức sim (không CCS) + kiểm live execution ở runtime. Cascade turbine-trip→áp tăng→MFT: driver (áp tăng khi draw=0) kiểm ở sim; C&E hoàn tất khi áp>19,3 | doc 09/10 |
| GĐ‑48 | Trip đổi PHYSICS (v1.1, doc 10 §9): BoilerIslandModel đọc flag trip do C&E chốt → **MFT** (BLR_MFT_TRIP/MILLS_TRIP/FUEL_VALVES_CLOSE/PA_FANS_TRIP) cắt than về 0 → hơi/áp sập; **turbine trip** (TRB_TRIP/MSV_CLOSE) → đóng draw, MW=0, áp tăng. MW = min(lệnh, hơi sinh)×hệ số chân không → MFT làm MW tụt theo hơi. resetCauseEffect xoá luôn flag → phục hồi (OTS: trip→reset→restart). Vận hành thường không đổi (flag mặc định 0). Hệ quả: C&E tự tác động trên CCS live — leak mạnh (≥ công suất bù ~600 t/h) đẩy drum tới −250 → MFT (test alarm bắt LOW ngay lúc nổi thay vì chờ trạng thái cuối) | doc 10 §9 |
| GĐ‑47 | CauseEffectEngine + thermalCauseEffect (doc 09 §4, NFPA 85): **2 ma trận** boiler-MFT (6 nguyên nhân × 4 hệ quả) + turbine-trip (3×2) — §10 C&E ✓. Engine generic latch trip, reset chỉ khi hết nguyên nhân. Đánh giá mỗi bước trên CCS thật; test kiểm inject loss-of-vacuum → turbine trip chốt. Hệ quả ghi tag flag `*_TRIP` (actuation nối vào sim = sâu hơn, để sau); ngưỡng ngoài Design Basis (vacuum>20 kPa, ms>19,3) = [GIẢ ĐỊNH] | doc 09 §4 |
| GĐ‑46 | ScenarioRunner + thermalScenarios (doc 22, nghiệm thu §10): kịch bản **cold-start→light-off→fill→mill start→turbine roll→sync→ramp 550→mill trip→runback→MFT/coast-down** (10 pha) chạy end-to-end trên CCS thật — test kiểm quỹ đạo MW (ramp lên, coast-down xuống). Engine generic ráp SFC + malfunction + tải qua ScenarioHost. Pha khởi động chạy SFC mang tính ĐIỀU PHỐI (sim warm-start ở điểm vận hành; physics cold-start đầy đủ từ nguội = pha sim sâu hơn, để sau). MFT mô phỏng bằng cắt tải (=0); số bước settle = [GIẢ ĐỊNH] | doc 22 |
| GĐ‑45 | SequenceEngine + thermalSequences (doc 09, ISA-88/NFPA 85): **8 chuỗi SFC khai báo** (mill start/stop · boiler purge · light-off · feedwater fill · turbine roll · gen sync · unit runback) — §10 "8 sequence" ✓. Engine generic thông dịch SequenceDef (permissive-gate · actions ghi có audit · transition tag + holdMs · timeout→failed), không hardcode logic bước. Thời gian giữ/ngưỡng bước = [GIẢ ĐỊNH] (mô phỏng, tinh chỉnh khi vận hành); tag lệnh `*_CMD` là điểm breadth. runSequenceToCompletion chạy đồng hồ ảo (không đụng đồng hồ/CCS sim) | doc 09 |
| GĐ‑44 | LoopGenerator (doc 09): định nghĩa GENERIC "loop = instance có cả `_PV` + `_OP`" → sinh **29 ControlLoopDef** breadth (≥ 25 §10 ✓), chưa gồm 7 loop CCS live đã tinh chỉnh của Boiler Island. Là DANH MỤC: mode khởi tạo MAN, tuning mặc định kp1/ki0,1/kd0 + SP=trung điểm dải PV ([GIẢ ĐỊNH], tinh chỉnh khi đưa vào vận hành). Thêm 4 nhóm control_loop BoP (FGD·than·khí nén·HVAC) → registry lên **3.610 tag / 662 alarm / 87 màn hình** | doc 09 |
| GĐ‑43 | ScreenGenerator (doc 12): sinh **87 màn hình** khai báo từ registry (47 D3/nhóm thiết bị · 18 D2/cell tổng quan · 18 D4/cell chẩn đoán), đạt §10 ≥ 70. Là DANH MỤC: không ép vào nav live (tránh ô rỗng vì đa số tag breadth chưa có dữ liệu sim); nav live vẫn dùng 3 màn hình boiler thủ công. Ô đại diện = float đầu (D3/D2) hoặc tag có alarm (D4); trần 12 ô/màn hình | doc 12 |

## 2. Vấn đề mở
> ✔ M‑05 (bài test generic): thêm `water-treatment-demo` chỉ chạm `plugins/water-treatment-demo/*` + `pnpm-lock.yaml` — **0 dòng sửa `packages/*` & `apps/*`** (kiểm bằng `git status`). Luận điểm "mọi nhà máy chỉ là plugin" đứng vững.
> ✔ Seed §10 (doc 07 §5): `SeedGenerator` (engine generic) + `thermalSeedSpec` (dữ liệu plugin) → **3.522 tag / 651 alarm**, đạt ngưỡng nghiệm thu §10 (≥ 3.000 / ≥ 600). Bề rộng = thêm DỮ LIỆU khai báo, engine/kernel không đổi (GĐ‑42).
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
