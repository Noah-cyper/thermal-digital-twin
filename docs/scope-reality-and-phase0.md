# Tuyên bố phạm vi (§2) & GIAI ĐOẠN 0 — briefing tiền‑doc‑00

> **Đây KHÔNG phải `00-vision-scope.md`.** File này là briefing chốt phạm vi + câu hỏi làm rõ,
> tuân đúng "lệnh khởi động" §18 của `docs/00-master-prompt.md`. Nội dung §2 và câu trả lời
> GIAI ĐOẠN 0 sẽ được đưa vào `00-vision-scope.md` **sau khi** anh phê duyệt — chưa sinh doc 00.
>
> Mọi con số công sức bên dưới là **[GIẢ ĐỊNH]** (ước lượng, không có trong Design Basis), sẽ đăng
> ký vào `docs/25-assumptions-open-issues.md` khi doc 25 ra đời. Chúng được **suy ra bottom‑up**
> (có bảng), không phải con số ném ra.

---

## §2.1 — Ước lượng công sức thực tế (person‑month)

### Mô hình bottom‑up (person‑month của **1 senior**, đúng độ sâu mà bộ 26 tài liệu yêu cầu) — `[GIẢ ĐỊNH]`

| Tầng | Hạng mục | PM | Có trong v1? |
|---|---|---:|---|
| **L1 Kernel** | UNS · Asset Model (ISA‑95/88) · Data Contract · Event Bus · Plugin Loader (hot‑load, semver, isolation) · Config Store · Audit · Time Service | **9** | ✔ toàn bộ |
| **L2 Engines** | 12 engine: Tag/Realtime · Alarm (ISA‑18.2) · Historian+Replay · Graphics Runtime · Faceplate · Navigation · Simulation · Control (PID/SFC) · Security/RBAC · Report/KPI · Maintenance · AI Advisor | **28** | ✔ (AI = rule‑based; Report designer → v2) |
| **L0 Integration** | MQTT Sparkplug B (v1) · OPC UA/Modbus/IEC 61850 driver thật (v3) | **6** | 2 (chỉ MQTT) |
| **L4 Presentation** | Operator client · Video Wall · Mobile viewer (v2) · Report viewer | **5** | 4 |
| **L5 Engineering** | Screen Builder · Tag Builder · Alarm Rationalizer · Plugin SDK/CLI (v2) + schema & validate CLI (v1) | **7** | 1 |
| **Plugin #1 Thermal** | 40 hệ × 13 mục · 3.000 tag · sim model · 70 màn hình · 600 alarm · 25 loop · 8 sequence · C&E MFT/turbine trip · SOP | **18** | ✔ |
| **Plugin #2 demo** | `water-treatment-demo` — bài test tính generic (§5.4) | **1** | ✔ |
| **Cross‑cutting** | loadgen · benchmark · CI · test harness · 26 tài liệu · e2e | **8** | ~5 |
| **TỔNG — đầy đủ v1+v2+v3, đúng độ sâu tài liệu** | | **~82** (dải 75–95) | |
| **Riêng v1** (Core + thermal đầy đủ theo §10 + plugin #2) | | **~63** (dải 60–70) | |

### Quy đổi ra thời gian lịch cho "1 người + AI" — `[GIẢ ĐỊNH]`

| Giả định | Giá trị | Ghi chú |
|---|---|---|
| 1 senior full‑time | 1 PM / tháng lịch | không có nhân lực song song |
| Hệ số tăng tốc AI | **1,8–2,5×** | cao ở scaffolding/schema/docs/test; **thấp** ở sim physics, alarm rationalization, control tuning, kiến trúc — nơi phải tự review từng dòng |
| Song song hoá | **0** | solo → không rút critical path bằng "thêm người" |

| Mốc | PM senior | ÷ AI (~2×) | Thời gian lịch solo |
|---|---:|---:|---|
| Đầy đủ v1+v2+v3 | ~82 | ~40 PM hiệu dụng | **~3–3,5 năm** |
| Riêng v1 (đủ §10) | ~63 | ~31 PM hiệu dụng | **~2,5–3 năm** |
| **Lát cắt 12 tuần** | — | ~6 PM hiệu dụng (3 PM lịch × 2) | **12 tuần** |

### Kết luận thẳng (không tô hồng)

**Tiêu chí nghiệm thu plugin #1 tại §10 (≥ 40 hệ · ≥ 3.000 tag · ≥ 70 màn hình · ≥ 600 alarm ·
≥ 25 loop · kịch bản cold‑start→…→coast‑down) KHÔNG khả thi trong 12 tuần cho 1 người + AI.**
Đó là khối lượng ~2,5–3 năm lịch solo.

→ Vì vậy **lát cắt 12 tuần = lát cắt CHỨNG MINH KIẾN TRÚC** (~6 PM hiệu dụng), không phải v1 đầy đủ:
kernel generic + **một vertical sâu** (Boiler Island core) + plugin #2 tí hon để chứng minh
"mọi nhà máy chỉ là plugin". Toàn bộ breadth còn lại của thermal (34 hệ BoP, đủ 3.000 tag,
đủ 70 màn hình) là **cung đường v1‑complete** kéo dài sau lát cắt.

---

## §2.2 — Những phần **KHÔNG** đạt ngang PCS7 / 800xA trong v1 (không hứa)

| Hạng mục | PCS7 / 800xA | IDTP v1 | Vì sao |
|---|---|---|---|
| An toàn SIL 2/3 (IEC 61508/61511), F‑System | Có, hardware+firmware chứng nhận TÜV | **Không** | IDTP là OTS/HMI **read‑only**, không phải hệ an toàn; không xin chứng nhận |
| Redundancy hot‑standby cấp controller (CPU dự phòng, failover < ms) | Có (vd AS 410H) | **Không** | Không có controller vật lý — IDTP ở tầng supervisory/HMI |
| Real‑time cứng tại I/O (cyclic ≤ 10 ms, tất định) | Có (RTOS/firmware) | **Không** (soft RT 250 ms–1 s) | Chạy trên Node/web, không phải RTOS |
| Hệ sinh thái driver phần cứng (hàng nghìn driver chứng nhận, ET200, Profibus/Profinet stack) | Có | v1 chỉ **Sim + MQTT** | OPC UA/Modbus/61850 thật = **v3** |
| Kiểm định cho nhà máy quy chế (grid code; **hạt nhân loại trừ hẳn** — §1) | Có track record FAT/SAT | **Không** | Chưa có bên thứ ba kiểm định, chưa có installed base |
| Vòng đời & hậu mãi (spare 20 năm, service toàn cầu) | Có | **Không** | Sản phẩm mới, chưa có mạng lưới |
| MTBF/availability từ nền lắp đặt thực | Có số thực | **Không** | Chưa có dữ liệu vận hành thực |

---

## §2.3 — Những phần **đạt hoặc VƯỢT** PCS7 / 800xA (v1)

| Hạng mục | Lợi thế IDTP | So với legacy DCS |
|---|---|---|
| Kiến trúc web, thin client zero‑install | Mở màn hình trên mọi thiết bị / 4K video wall qua browser | Client cài đặt nặng, khoá HĐH |
| UNS first‑class + Sparkplug B | Chuẩn hoá namespace ngay từ lõi (KKS↔UNS↔Sparkplug↔tag id) | Nhiều DCS retrofit UNS chật vật |
| Replay + Re‑simulation (what‑if, branch historian) | Snapshot → chạy lại mô phỏng vào nhánh riêng | Đa số DCS chỉ có trend replay |
| AI advisor read‑only có guardrail | Giải thích alarm/SOP kèm nguồn trích dẫn (tag+thời gian+SOP) | Legacy gần như không có |
| Tốc độ engineering | Màn hình = JSON khai báo; nhà máy mới = **plugin** (ngày, không phải tháng) | Engineering nặng, license theo tag |
| Chi phí | Stack open‑source (TimescaleDB/PostgreSQL/Mosquitto/Node) | License 6–7 chữ số + phí theo tag |
| Triển khai linh hoạt | Docker / cloud / on‑prem / **air‑gap** | Phần cứng độc quyền |
| Minh bạch & mở rộng | Config đọc được, SDK có tài liệu, không khoá nhà cung cấp | Nhị phân độc quyền, vendor lock‑in |

---

## §2.4 — Lát cắt v1 (MVP) đúng **12 tuần**

> **Mục tiêu lát cắt = tiêu chí kết thúc v1 của §2**: *"thêm plugin mới không sửa 1 dòng code kernel"*
> (bài test generic §5.4). **KHÔNG** phải §10 acceptance. Depth trước breadth: đi **sâu** một
> vertical (Boiler Island) đủ để chứng minh mọi engine lõi hoạt động end‑to‑end.

| Tuần | Deliverable (đã thu hẹp so với annex §11.3) | Definition of Done |
|---|---|---|
| **W1** | Monorepo (pnpm+Turborepo), Docker Compose (Timescale+PG+Mosquitto), CI gate (build/lint/typecheck/test), kernel package skeleton, **interface + schema** (được phép theo luật cứng) | `pnpm build` xanh, container lên |
| **W2** | Data Contract + tag‑model (Zod), Asset Model ISA‑95 loader, UNS + KKS **ánh xạ 3 chiều**, seed ~300 tag Boiler Island | truy vấn tag qua REST |
| **W3** | Plugin Loader (manifest, semver, hot‑load, namespace isolation) + Config Store + Audit + Time Service | nạp plugin thermal & plugin #2 rỗng, **không sửa kernel** |
| **W4** | **Walking skeleton**: Sim (drum mass/energy + 1 BFP + PID mức 3‑element) → MQTT Sparkplug → Tag/Realtime → WS delta → 1 màn hình SVG động | giá trị đổi realtime trên browser, trễ sim→pixel < 500 ms |
| **W5** | Sim core Boiler Island: combustion (coal→heat→steam), **drum swell/shrink**, main steam τ/θ, O₂; loop Boiler master · Fuel master · Air/O₂ trim · Furnace draft | ramp tải dải hẹp không dao động |
| **W6** | Control Engine: PID anti‑windup + **bumpless** MAN/AUTO/CASCADE, interlock/permissive là first‑class object, 6–8 loop | chuyển mode bumpless, **hiện lý do bị chặn** |
| **W7** | Graphics Runtime: đọc `*.screen.json` → render SVG, binding khai báo `{property,tag,transform,condition}`; Faceplate 4 tab; Navigation từ `nav/tree.yaml` | 8–10 màn hình JSON, screen call‑up < 1 s |
| **W8** | Alarm Engine ISA‑18.2: state machine đầy đủ, deadband + on/off‑delay, P1–P4, shelving có hạn + audit, suppression theo trạng thái; Alarm Summary/History | ACK/shelve có audit, ~40–60 alarm đã rationalize |
| **W9** | Historian + Replay: Timescale hypertable + rollup + compression; snapshot 5'; **DATA REPLAY (banner tím)** seek < 2 s; Trend 8 pen | truy vấn 24h/8 tag < 2 s, replay đồng bộ màn hình |
| **W10** | Security/RBAC 6 vai + JWT 15' + refresh xoay vòng + **xác nhận 2 bước** + audit bất biến; Operator client shell (banner/nav/ribbon) hoàn chỉnh | ma trận quyền×hành động thực thi được, lệnh ghi có audit |
| **W11** | **Plugin #2 `water-treatment-demo`** (~60 tag, 3 màn hình, 2 bơm, 1 bể, 1 PID mức, 8 alarm) — **BÀI TEST GENERIC** | thêm plugin #2 **KHÔNG sửa 1 dòng** `apps/` & `packages/kernel` |
| **W12** | loadgen + `docs/benchmark.md`; OTS cơ bản (freeze/snapshot/restore + 3 malfunction); rule‑based diagnostics tối thiểu; e2e Playwright; vá hiệu năng | đạt bảng chỉ tiêu ở quy mô lát cắt; kịch bản demo chạy |

### Tiêu chí kết thúc lát cắt (6 điều, đo được)

1. Thêm `water-treatment-demo` **không sửa** `packages/kernel` & `apps/*`.
2. Màn hình **100% JSON khai báo**, kernel render — 0 màn hình process hardcode trong React.
3. Chuỗi **sim → MQTT → historian → WS → HMI** khép kín, **không `Math.random()`** làm nguồn process.
4. Alarm **ISA‑18.2** có deadband + delay + audit.
5. **DATA REPLAY** banner tím, seek < 2 s, đồng bộ màn hình + trend + alarm.
6. **RBAC 6 vai** + mọi lệnh ghi có audit bất biến + xác nhận 2 bước.

### Cố ý **loại khỏi** 12 tuần (đẩy sang v1‑complete)

34 hệ BoP còn lại · đủ 3.000 tag · đủ 70 màn hình · đủ 600 alarm · đủ 25 loop / 8 sequence ·
sim đầy đủ turbine/generator/electrical/switchyard · kịch bản full `cold‑start→purge→light‑off→sync→ramp 0→600 MW→mill trip→runback→MFT→coast down` ·
**Re‑simulation what‑if (banner cam)** · CEMS/FGD · mobile viewer.

---

## §2.5 — Đẩy sang v2 / v3

| Phiên bản | Hạng mục | Tiêu chí kết thúc (§2) |
|---|---|---|
| **v2 — Engineering & AI** | L5 Screen Builder · Tag Builder · Alarm Rationalizer · Plugin CLI; AI advisor thật (RAG C&E+SOP, phân tích trend, report designer, chat có intent‑filter); **Re‑simulation what‑if**; predictive maintenance rule‑based; mobile viewer | người không biết code tạo được 1 màn hình mới |
| **v3 — Scale & Field** | Driver thật OPC UA/Modbus/IEC 61850; redundancy; multi‑site; ML predictive (≥ 6 tháng dữ liệu thật); tối ưu vận hành định lượng | chạy song song DCS thật ở chế độ **read‑only** |

---

## GIAI ĐOẠN 0 — 8 câu hỏi làm rõ (kèm phương án mặc định)

> Trả lời **"OK"** để nhận **tất cả** mặc định, hoặc chỉ nêu câu muốn đổi. Sau đây tôi **DỪNG**,
> không viết code, không sinh doc 00.

| # | Câu hỏi | Mặc định (đề xuất) | Phương án khác |
|---|---|---|---|
| **1** | Cấu hình tổ máy? | **1 × 600 MW** (khớp Design Basis §3 Phụ lục A) | 2 × 300 MW / 4 × 300 MW |
| **2** | Plugin thứ hai (bài test generic §5.4)? | **`water-treatment-demo`** (~60 tag, 3 màn hình) | cement · compressed‑air · ngành khác |
| **3** | Ngôn ngữ HMI? | **Song ngữ VI/EN** | chỉ EN |
| **4** | Triển khai? | **Docker Compose on‑prem** | cloud · Electron desktop · air‑gap |
| **5** | Độ phân giải & video wall? | **2 × 4K + fallback 1920×1080** | chỉ 1920×1080 |
| **6** | Twin/OTS/AI trong **lát cắt 12 tuần**? *(CLAUDE.md đã khoá: AI = rule‑based; DT = L1+L2 = OTS+Virtual Commissioning)* | **OTS cơ bản** (freeze/snapshot/restore + 3 malfunction) **có** trong slice; rule‑based diagnostics **tối thiểu** ở W12 | đẩy OTS ra sau slice · hoặc mở rộng malfunction ngay |
| **7** | SSO/LDAP & số client đồng thời? | **RBAC local 6 vai, không SSO ở v1**; **20 client** đồng thời (khớp §9) | bật OIDC/LDAP ngay · số client khác |
| **8** | Ưu tiên? | **Kiến trúc‑trước, nhưng qua walking‑skeleton W1–W4** (kernel‑first, chứng minh generic sớm) | demo‑đẹp‑trước |

---

```
TRẠNG THÁI: Tiền‑doc‑00 — §2 (Tuyên bố phạm vi) + GIAI ĐOẠN 0. Chưa sinh doc 00, chưa viết code.
ĐÃ XONG: §2.1 ước lượng công sức bottom‑up (~82 PM full / ~63 PM v1) + quy đổi 1 người+AI;
         §2.2 bảng KHÔNG đạt PCS7/800xA; §2.3 bảng đạt/vượt; §2.4 lát cắt 12 tuần (W1–W12)
         + 6 tiêu chí kết thúc + phần loại trừ; §2.5 v2/v3; 8 câu hỏi GIAI ĐOẠN 0.
GIẢ ĐỊNH MỚI: [GĐ‑01] hệ số AI 1,8–2,5×; [GĐ‑02] PM theo tầng (bảng §2.1); [GĐ‑03] §10 acceptance
             ≈ 2,5–3 năm solo → 12 tuần chỉ đủ lát cắt chứng minh kiến trúc. (→ đăng ký doc 25)
XUNG ĐỘT / RỦI RO: (a) §10 acceptance vs "12 tuần" mâu thuẫn về khối lượng → đã tách "lát cắt
             chứng minh kiến trúc" khỏi "v1‑complete". (b) Branch: đang làm trên
             `claude/idtp-scope-phase-0-y2fxa7` (branch được chỉ định), khác ghi chú cũ
             `claude/doc-analysis-lna6sz` — cần anh xác nhận nếu muốn đổi.
CẦN QUYẾT ĐỊNH: 8 câu GIAI ĐOẠN 0 (gõ "OK" để nhận hết mặc định); xác nhận lát cắt 12 tuần =
             chứng minh kiến trúc (không phải §10 đầy đủ); xác nhận branch.
BƯỚC TIẾP THEO: sau khi anh trả lời → sinh `docs/00-vision-scope.md` (doc 00) → tóm tắt ≤ 15 dòng
             → hỏi [PHÊ DUYỆT TÀI LIỆU 00?].
```
