# PROMPT BÀN GIAO — IDTP · Thermal Power 600 MW Digital Twin

> Dán toàn bộ file này vào một phiên Claude Code mới (tài khoản khác) để tiếp nhận dự án và làm tiếp.
> Ngôn ngữ tài liệu: tiếng Việt; thuật ngữ kỹ thuật + code/identifier: tiếng Anh.
> Cập nhật: 2026-08 (sau: coverage ≥70% GĐ-30 · rationalize 6+1 alarm BoP GĐ-105 · calibration playbook doc 27 · engines/plugin/kernel >90%). 365 test xanh.

---

## 0. ĐỌC TRƯỚC KHI LÀM (bắt buộc, đúng thứ tự)

1. `CLAUDE.md` (luật dự án — override mọi hành vi mặc định)
2. `docs/00-master-prompt.md` (prompt cha: kiến trúc platform + plugin contract + bộ tài liệu 00–25)
3. `docs/annex-A-thermal-design-basis.md` (Design Basis 600 MW — **lấy nguyên số, không đổi**)
4. `docs/25-assumptions-open-issues.md` (sổ `[GIẢ ĐỊNH]` **GĐ-01…105** + vấn đề mở **M-01…06**) · `docs/27-calibration-playbook.md` (thủ tục M-06)
5. `docs/05-engine-specs.md` · `docs/06-process-analysis-thermal.md` (đặc tả engine + 45 hệ thống)
6. `docs/status/completion-report.html` (báo cáo trạng thái đã kiểm chứng) · `README.md` (chạy localhost:8080)

## 1. DỰ ÁN LÀ GÌ

Nền tảng **Digital Twin công nghiệp (IDTP)** kiểu **kernel + plugin** — *"mọi nhà máy chỉ là một plugin"*.
Kernel/engine generic chạy **dữ liệu khai báo** của plugin → thêm nhà máy mới = thêm plugin, **không sửa 1 dòng kernel** ("bài test generic", đã đạt: thêm `water-treatment-demo` không chạm `packages/*` & `apps/*` — M-05 ✓).

Plugin #1 = **`thermal-power-600`**: nhiệt điện than **600 MW** subcritical, drum-type, **reheat**, balanced draft, lưới 500 kV.

## 2. TRẠNG THÁI HIỆN TẠI (đã xong — đừng làm lại)

- **Repo:** `Noah-cyper/thermal-digital-twin` · **trunk (nhánh mặc định, tích luỹ toàn bộ) = `claude/doc-analysis-lna6sz`**. Nhiều tài khoản commit vào chung trunk này.
- **365 test xanh · 11/11 task Turbo · CI** (`.github/workflows/ci.yml`, Node 20/22, pnpm 9.7.0) · trunk sạch, đã push. **Coverage ≥70% mọi package mã-runtime (GĐ-30 ✔):** engines 91,7% · plugin 97,1% · kernel 93,9% · app 83% (`@idtp/sdk` type-only). Đo: `pnpm exec vitest run --coverage` (đã cài `@vitest/coverage-v8`).
- **24 mô hình mô phỏng** (`plugins/thermal-power-600/src/sim/`), hợp thành **additive**, khép **cân bằng năng lượng toàn nhà máy ~100%** (kiểm chứng chéo `PlantBalanceModel`):
  - Lõi chu trình: `boiler-island` · `turbine-generator` · `reheat-cycle` · `feedwater-train` · `condenser-cw`
  - Khói/điện/nước: `fluegas-air` · `emissions` · `electrical` · `switchyard` · `cooling-tower` · `coal-handling`
  - **BoP đầy đủ (10 hệ):** `compressed-air` · `fuel-oil` · `ash-handling` · `soot-blower` · `water-treatment` · `emergency-power` · `hvac` · `fire-fighting` · `chemical-dosing` (+ `bypass-airremoval` SJAE/bypass)
  - Tổng hợp/hiệu chỉnh: `plant-balance` · `calibration` (+ `registry-sim` breadth-live · `drum` skeleton tham chiếu)
- **~12 engine L2 generic** (`packages/engines`, `packages/kernel`): tag-realtime · graphics · alarm(ISA-18.2 shelving) · control-loop · sequence(SFC) · cause-effect · interlock · simulation-host · historian(+timescale ≥50k điểm/s) · sparkplug · navigation · faceplate · kpi · report · maintenance · predictive · ai-advisor(read-only) · event-journal(SOE) · security(RBAC) · scenario-runner · screen-builder · seed/loop/screen generators.
- **Registry §10:** **3.522 tag / 651 alarm** (SeedGenerator × thermalSeedSpec) · **25 vòng điều khiển kín** (governor→CCW) · 8 SFC · 2 ma trận C&E · 7 luật interlock · ~13 malfunction OTS.
- **HMI runtime:** `apps/thermal-runtime` phục vụ **99 màn hình** (render từ JSON) + WebSocket delta-only + RBAC 6 vai + OTS (freeze/snapshot/malfunction/trip tay) + Historian/Replay + Report/Event-Log/Diagnostic/AI-Advisor/Screen-Builder tại **localhost:8080**.
- **Dashboard tự chứa:** `docs/dashboard/twin.html` (client-side, artifact) — mimic + trend thời gian thực + khu BoP + 3 nút tiêm sự cố (mất khí nén · rò nhựa DM · mất điện khẩn).
- **Báo cáo hoàn thành:** `docs/status/completion-report.html` (artifact). **Monitor token:** `tools/usage-monitor/` (statusline + hook cảnh báo).
- **Registry docs đối chiếu BoP xong:** doc 07 §4.1 (tag) · doc 08 §5.1 (alarm) · doc 10 §13 (sổ đăng ký model additive).

## 3. LẤY VIỆC & CHẠY

```bash
# Node ≥ 20, pnpm 9.7.0 (corepack enable && corepack prepare pnpm@9.7.0 --activate)
git checkout claude/doc-analysis-lna6sz && git pull
pnpm install
pnpm --filter @idtp/app-thermal-runtime serve   # → http://localhost:8080  (PORT=xxxx để đổi cổng)
pnpm build      # tsc
pnpm test       # turbo run test → 318 xanh
```
Người dùng demo (mật khẩu `p`): `viewer·operator·supervisor·engineer·maint·admin` (auto-login Operator).

## 4. KIẾN TRÚC & BỐ CỤC MÃ

- **Monorepo pnpm + Turborepo**: `apps/*` (thermal-runtime, walking-skeleton) · `packages/*` (sdk, kernel, engines) · `plugins/*` (thermal-power-600, water-treatment-demo).
- **TS strict** (noUncheckedIndexedAccess, verbatimModuleSyntax → `import type`, noImplicitOverride, noFallthroughCasesInSwitch). exactOptionalPropertyTypes = OFF.
- **Contract khai báo ở `@idtp/sdk`**; plugin runtime **chỉ import `@idtp/sdk`** (không import engine/kernel).
- **Mô phỏng tất định**: FOPTD (τ/θ), nhiễu LCG có seed, Stodola, swing máy phát. **KHÔNG `Math.random`** cho dữ liệu process.
- **Sim model ADDITIVE** (khuôn mẫu để thêm physics): mỗi model đăng ký SAU model nó phụ thuộc → đọc tag tươi, chỉ **sinh thêm tag**, **0 hồi quy** tag khác. Có trạng thái → `snapshot`/`restore`.
- **Adapter hạ tầng dùng dependency INJECT** (SqlExecutor cho Timescale, MqttTransport/SpCodec cho Sparkplug) → lõi engine không phụ thuộc `pg`/`mqtt.js`/protobuf, **kiểm được không cần DB/broker**.
- **Màn hình = JSON khai báo**, kernel render generic theo symbol + binding `{property, tag, transform, condition}`. **Cấm hardcode màn hình process trong React.**

## 5. LUẬT CỨNG (vi phạm = hỏng — xem CLAUDE.md)

- KHÔNG `Math.random` làm nguồn dữ liệu process (dùng LCG có seed / id UUID tất định).
- KHÔNG stub / TODO / "phần còn lại tương tự" / code rút gọn — mỗi file phải chạy được.
- KHÔNG hardcode màn hình process trong React — màn hình là JSON, kernel render.
- KHÔNG để plugin chứa logic kernel, hoặc kernel biết tên plugin cụ thể.
- KHÔNG gộp cây thiết bị (ISA-95) với cây điều hướng (ISA-101).
- Mọi số ngoài Design Basis → gắn `[GIẢ ĐỊNH]` + đăng ký GĐ mới trong `docs/25` (kế tiếp = **GĐ-106**).
- **AI / nhật ký / chẩn đoán READ-ONLY tuyệt đối**: không ghi tag, không đổi setpoint, không ACK alarm.
- Alarm luôn có deadband + delay; lệnh ghi luôn có audit trail + xác nhận 2 bước (lệnh nguy hiểm).

## 6. QUY TRÌNH LÀM VIỆC (giữ đúng để nhất quán với công việc trước)

Mỗi hạng mục = 1 batch:
1. **Làm việc trên trunk `claude/doc-analysis-lna6sz`** (nhiều tài khoản commit chung nhánh này). *Nếu harness của tài khoản mới chỉ định nhánh feature riêng → làm ở đó rồi PR/merge vào `claude/doc-analysis-lna6sz`.* **Trước khi commit: `git fetch && git pull` để đồng bộ (tài khoản khác có thể vừa push).**
2. Viết code/tài liệu (đúng luật cứng) → `pnpm build` + `pnpm test` xanh (đừng để tụt dưới 318).
3. Số ngoài Design Basis → **1 dòng GĐ mới** trong `docs/25` (kế tiếp GĐ-105). Nếu chạm dashboard → cập nhật `docs/dashboard/twin.html` và **redeploy artifact cùng URL**.
4. Commit **Conventional Commits**, kết bằng 2 trailer:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` và `Claude-Session: <link phiên>`.
5. `git push -u origin claude/doc-analysis-lna6sz` (retry backoff nếu lỗi mạng). **KHÔNG tạo PR trừ khi người dùng yêu cầu. KHÔNG push sang nhánh khác khi chưa được phép.**
6. Tài liệu governing (00–24) theo **phase-gate**: xong 1 doc → tóm tắt ≤15 dòng → hỏi `[PHÊ DUYỆT TÀI LIỆU NN?]` → **chờ**.
7. Kết mỗi phản hồi dài bằng khối:
   `TRẠNG THÁI / ĐÃ XONG / GIẢ ĐỊNH MỚI / XUNG ĐỘT–RỦI RO / CẦN QUYẾT ĐỊNH / BƯỚC TIẾP THEO`.

**Thêm một hệ physics mới (khuôn mẫu):** tạo `plugins/thermal-power-600/src/sim/<hệ>.ts` implement `ISimModel` (additive, đọc tag tươi, neo Design Basis, `[GIẢ ĐỊNH]` cho số ngoài DB) → export ở `plugins/.../src/index.ts` → `host.register(...)` trong `apps/thermal-runtime/src/runtime.ts` (SAU model phụ thuộc) → thêm tag `recordedTags` → màn `D3-<hệ>` trong `graphics/screens.ts` → 1 unit test (plugin) + 1 integration test (runtime) → GĐ mới → cập nhật `docs/dashboard/twin.html` (redeploy artifact).

## 7. CÒN LẠI / HẠNG MỤC MỞ (phần lớn cần dữ liệu/hạ tầng THẬT — ngoài phạm vi mô phỏng)

- **M-06 (quan trọng):** calibrate enthalpy chu trình để **hiệu suất net ~33% → 39%** thiết kế (heat rate đơn vị ~10.900 → 9.200 kJ/kWh). Hằng số enthalpy hiện là `[GIẢ ĐỊNH]` bảo thủ (GĐ-66/68/73); **cân bằng năng lượng vẫn khép ~100%** (nhất quán nội bộ) — chỉ chênh tuyệt đối với thiết kế. **QĐ v1 (C1): GIỮ 33% trung thực** đến khi có **heat balance nhà chế tạo**. Đừng ép số. **Thủ tục retune shovel-ready: `docs/27-calibration-playbook.md`** (đầu vào bắt buộc · 6 bước · tiêu chí nghiệm thu).
- **Hạ tầng THẬT ✔ khung sẵn cắm:** `docker-compose.yml` (Timescale + Mosquitto) + `apps/thermal-runtime/src/persistence.ts` (adapter pg/mqtt import ĐỘNG, BẬT bằng env `IDTP_TIMESCALE_URL`/`IDTP_MQTT_URL`, DI test-được) + `docs/26`. **Còn:** cắm hạ tầng THẬT + OPC-UA/Modbus + chạy tải hiện trường.
- **HMI/auth production:** thay token demo `'p'` bằng JWT/SSO/LDAP thật; SPA vững, 15k tag, nhiều client, video wall.
- **Chiều sâu physics:** AVR/kích từ + bảo vệ ANSI (87/40/46…) · per-heater + drain cascade · fouling/air-ingress động · CEMS Hg/CO · **bảng hơi enthalpy thật** (thay hằng số [GIẢ ĐỊNH]).
- **Chất lượng ✔ (đã xong):** coverage ≥70% mọi package runtime (GĐ-30 ✔, engines/plugin/kernel >90%) · rationalize **6+1** điều kiện BoP → AlarmDef first-class (GĐ-105, `bop-alarm-rationalization.test.ts`). **Còn:** app coverage >90% (bị chặn bởi adapter hạ tầng THẬT trong `persistence.ts` + WS glue `server.ts`).
- **M-02/M-03:** đối chiếu KKS breadth ↔ VGB-B 106 · xác nhận FGD với chủ đầu tư.
- **v2:** AI RAG/LLM thật · Report designer + xuất PDF/Excel · Event Log lọc/lưu bền. **v3:** OPC-UA/Modbus thật · CMMS · ML predictive.
- **Kiểm định bên thứ ba (FAT/SAT) + audit IEC 62443.**

## 8. BẪY ĐÃ GẶP (gotchas)

- **Server ESM:** `node dist/server.js` (tsc) **lỗi** `ERR_MODULE_NOT_FOUND` (import thiếu đuôi `.js`). Đã sửa bằng script `serve` = **esbuild bundle → `dist/server.mjs`** (đừng quay lại `node dist/server.js`). Bundle là artifact, không commit.
- **exactOptionalPropertyTypes OFF** → gán `prop: undefined` được chấp nhận; nhưng `noUncheckedIndexedAccess` ON → index trả `T | undefined`, phải guard.
- **RBAC:** Operator KHÔNG có `override`; `override/setpoint/mode` = TWO_STEP; `engineer` = single-step Engineer+. Chạy SFC live / reset C&E dùng action `engineer`. Shelve alarm = action `ack` (Operator+).
- **Nhiều tài khoản 1 trunk:** LUÔN `git pull` trước khi commit; **đừng revert file tài khoản khác vừa sửa** (server.ts, runtime.ts, index.ts, screens.ts, các model…). Xung đột thì merge, không ghi đè.
- **Không mở cổng public** từ container phiên web → localhost:8080 chỉ chạy trên máy người dùng (hoặc trong container để tự kiểm chứng bằng headless Chromium). Hướng dẫn người dùng tự chạy (xem `docs/RUN-PROMPT.md`).
- **Model id `claude-opus-4-8` chỉ dùng trong chat** — KHÔNG ghi vào commit/PR/code/artifact.
- **mcp__github__ tools hay rớt** giữa các lượt — nạp lại qua ToolSearch nếu cần (nhưng mặc định KHÔNG tạo PR).

## 9. VIỆC GỢI Ý TIẾP (chọn theo yêu cầu người dùng — hỏi trước khi làm việc lớn)

Ở mức code dự án **feature-complete**; việc trong repo còn lại nhỏ dần.

**✔ ĐÃ XONG (phiên 2026-08):** coverage ≥70% (GĐ-30 · engines 91,7%/plugin 97,1%/kernel 93,9%) · rationalize **6+1** alarm BoP first-class (GĐ-105 · malfunction `instrument-air-loss` mới ở `CompressedAirModel`) · calibration playbook (`docs/27`) · khung docker-compose (đã có sẵn, đã kiểm chứng).

**Hướng tiếp (chọn theo yêu cầu người dùng — hỏi trước khi làm việc lớn):**
- (1) **App coverage >90%** — lift `server.ts` (72%) bằng WS integration test THÊM cho command handler chưa phủ (`maintenance-query`·`create-wo`·`permissive-query`·`faceplate-trend`·`trend`·`report`·`journal`·`diag`·`advise`·`ce-reset`·`shelve`/`unshelve`·`malf`/`mft`/`turbine-trip`). `persistence.ts` (62%) bị chặn bởi adapter pg/mqtt THẬT (dòng ~23-56, import động) → dùng `/* c8 ignore */` hoặc để honest.
- (2) **Alarm-shelf UI** — server ĐÃ có lệnh `shelve`(durationMin+reason)/`unshelve` (action `ack`, Operator+, `alarm-shelf.test.ts`); phần thiếu là **UI client** (`public/index.html`): nút shelve có lý do + hẹn giờ + danh sách shelved + đếm ngược.
- (3) **Chiều sâu physics** — AVR/kích từ (thêm vòng điện áp→excitation→MVAr, ADDITIVE trên `electrical`) · per-heater + drain cascade (`feedwater-train`) · fouling/air-ingress động. Neo Design Basis, [GIẢ ĐỊNH] cho số ngoài DB.
- **(M-06)** chỉ khi có heat balance nhà chế tạo — theo `docs/27-calibration-playbook.md` (đừng tweak hằng số, đã chứng minh vỡ operating point).

Luôn kết mỗi phản hồi dài bằng khối trạng thái 6 mục (§6.7) và hỏi `[CẦN QUYẾT ĐỊNH]` trước khi sang việc lớn kế.
