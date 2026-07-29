# PROMPT BÀN GIAO — IDTP · Thermal Power 600 MW Digital Twin

> Dán toàn bộ file này vào một phiên Claude Code mới (tài khoản khác) để tiếp nhận dự án và làm việc tiếp.
> Ngôn ngữ tài liệu: tiếng Việt; thuật ngữ kỹ thuật + code/identifier: tiếng Anh.

---

## 0. ĐỌC TRƯỚC KHI LÀM (bắt buộc, đúng thứ tự)

1. `CLAUDE.md` (luật dự án — override mọi hành vi mặc định)
2. `docs/00-master-prompt.md` (prompt cha: kiến trúc platform + plugin contract + bộ tài liệu 00–25)
3. `docs/annex-A-thermal-design-basis.md` (Design Basis 600 MW — **lấy nguyên số, không đổi**)
4. `docs/25-assumptions-open-issues.md` (sổ đăng ký `[GIẢ ĐỊNH]` GĐ-01…73 + vấn đề mở M-01…06)
5. `docs/05-engine-specs.md` · `docs/06-process-analysis-thermal.md` (đặc tả engine + 45 hệ thống)
6. `README.md` (cách chạy localhost:8080)

## 1. DỰ ÁN LÀ GÌ

Nền tảng **Digital Twin công nghiệp (IDTP)** kiểu **kernel + plugin** — *"mọi nhà máy chỉ là một plugin"*.
Kernel/engine generic chạy **dữ liệu khai báo** của plugin → thêm nhà máy mới = thêm plugin, **không sửa 1 dòng kernel** (đây là "bài test generic", đã đạt: thêm `water-treatment-demo` không chạm `packages/*` & `apps/*`).

Plugin #1 = **`thermal-power-600`**: nhiệt điện than **600 MW** subcritical, drum-type, **reheat**, balanced draft, lưới 500 kV.

## 2. TRẠNG THÁI HIỆN TẠI (đã xong — đừng làm lại)

- **Repo:** `Noah-cyper/thermal-digital-twin` · **nhánh tích luỹ toàn bộ công việc = `claude/doc-analysis-lna6sz`** (coi như trunk; **32 PR đã merge vào đây**).
- **Build 7/7 · 232 test xanh · CI** (`.github/workflows/ci.yml`, Node 20/22, pnpm 9.7.0, mỗi push/PR).
- **Bộ tài liệu 00–25 đủ 26 file** + annex-A + benchmark.
- **12 mô hình mô phỏng** (`plugins/thermal-power-600/src/sim/`) khép **cân bằng năng lượng toàn nhà máy ~100%** (kiểm chứng chéo bằng `PlantBalanceModel`):
  `boiler-island` · `turbine-generator` · `reheat-cycle` · `feedwater-train` · `condenser-cw` · `cooling-tower` · `fluegas-air` · `emissions` · `electrical` · `coal-handling` · `plant-balance` · `registry-sim` (breadth-live).
- **21 engine L1/L2** (`packages/engines/`, `packages/kernel/`): tag-realtime · graphics · alarm · control-loop · sequence(SFC) · cause-effect · simulation-host · historian(+timescale) · navigation · faceplate · kpi · report · maintenance · predictive · ai-advisor · event-journal · security · sparkplug · scenario-runner · screen-builder · seed/loop/screen generators.
- **Registry §10:** 3.610 tag / 662 alarm / 87 màn hình catalog / 29 loop / 8 SFC / 2 ma trận C&E.
- **HMI runtime:** `apps/thermal-runtime` phục vụ **99 màn hình** + WebSocket delta-only + RBAC 6 vai + OTS (freeze/snapshot/malfunction) + Historian/Replay + Report/Event-Log/Diagnostic/AI-Advisor/Screen-Builder tại **localhost:8080**.
- **Dashboard tự chứa:** `docs/dashboard/twin.html` (chạy client-side, đã publish artifact) — giám sát nhanh không cần cài gì.
- **12 màn hình hệ thống ISA-101** đã đủ; roadmap tính năng v1→v3 đã hiện thực ở mức code.

## 3. LẤY VIỆC & CHẠY

```bash
# Node ≥ 20, pnpm 9.7.0 (corepack enable && corepack prepare pnpm@9.7.0 --activate)
git checkout claude/doc-analysis-lna6sz && git pull
pnpm install
pnpm --filter @idtp/app-thermal-runtime serve   # → http://localhost:8080  (PORT=xxxx để đổi cổng)
pnpm build      # tsc 7/7
pnpm test       # vitest 232
```
Người dùng demo (mật khẩu `p`): `viewer·operator·supervisor·engineer·maint·admin` (auto-login Operator).

## 4. KIẾN TRÚC & BỐ CỤC MÃ

- **Monorepo pnpm + Turborepo**: `apps/*` (thermal-runtime, walking-skeleton) · `packages/*` (sdk, kernel, engines) · `plugins/*` (thermal-power-600, water-treatment-demo).
- **TS strict** (noUncheckedIndexedAccess, verbatimModuleSyntax → `import type`, noImplicitOverride, noFallthroughCasesInSwitch). exactOptionalPropertyTypes = OFF.
- **Contract khai báo ở `@idtp/sdk`**; plugin runtime **chỉ import `@idtp/sdk`** (không import engine/kernel).
- **Mô phỏng tất định**: FOPTD (τ/θ), nhiễu LCG có seed, Stodola, swing máy phát. **KHÔNG `Math.random`** cho dữ liệu process.
- **Sim model ADDITIVE**: mỗi model mới đăng ký SAU (đọc tag tươi của model trước), chỉ **sinh thêm tag**, **0 hồi quy** tag của model khác. Đây là khuôn mẫu để thêm hệ physics.
- **Adapter hạ tầng dùng dependency INJECT** (SqlExecutor cho Timescale, MqttTransport/SpCodec cho Sparkplug) → lõi engine không phụ thuộc `pg`/`mqtt.js`/protobuf, **kiểm được không cần DB/broker**.
- **Màn hình = JSON khai báo**, kernel render generic theo symbol + binding `{property, tag, transform, condition}`. **Cấm hardcode màn hình process trong React.**

## 5. LUẬT CỨNG (vi phạm = hỏng — xem CLAUDE.md)

- KHÔNG `Math.random` làm nguồn dữ liệu process (dùng LCG có seed / id UUID tất định).
- KHÔNG stub / TODO / "phần còn lại tương tự" / code rút gọn — mỗi file phải chạy được.
- KHÔNG hardcode màn hình process trong React — màn hình là JSON, kernel render.
- KHÔNG để plugin chứa logic kernel, hoặc kernel biết tên plugin cụ thể.
- KHÔNG gộp cây thiết bị (ISA-95) với cây điều hướng (ISA-101).
- Mọi số ngoài Design Basis → gắn `[GIẢ ĐỊNH]` + đăng ký GĐ mới trong `docs/25`.
- **AI / nhật ký / chẩn đoán READ-ONLY tuyệt đối**: không ghi tag, không đổi setpoint, không ACK alarm.
- Alarm luôn có deadband + delay; lệnh ghi luôn có audit trail + xác nhận 2 bước (lệnh nguy hiểm).

## 6. QUY TRÌNH LÀM VIỆC (giữ đúng để nhất quán 32 PR trước)

Mỗi hạng mục = 1 batch:
1. Tạo nhánh feature off trunk `claude/doc-analysis-lna6sz` (vd `claude/idtp-<tên>`). *(Hoặc theo nhánh chỉ định của harness tài khoản mới; nhưng công việc PR vào `claude/doc-analysis-lna6sz`.)*
2. Viết code/tài liệu (đúng luật cứng) → `pnpm build` 7/7 + `pnpm test` xanh.
3. Ghi **1 dòng GĐ mới** trong `docs/25` (số GĐ kế tiếp) + cập nhật footer `docs/overview/index.html` (đếm test) nếu liên quan.
4. Commit **Conventional Commits**, kết bằng 2 trailer:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` và `Claude-Session: <link phiên>`.
5. `git push -u origin <nhánh>` → tạo PR (base `claude/doc-analysis-lna6sz`, footer `🤖 Generated with Claude Code`) → **merge (merge commit)**.
6. Kết mỗi phản hồi dài bằng khối:
   `TRẠNG THÁI / ĐÃ XONG / GIẢ ĐỊNH MỚI / XUNG ĐỘT–RỦI RO / CẦN QUYẾT ĐỊNH / BƯỚC TIẾP THEO`.

**Thêm một hệ physics mới (khuôn mẫu):** tạo `plugins/thermal-power-600/src/sim/<hệ>.ts` implement `ISimModel` (additive, đọc tag tươi, neo Design Basis, `[GIẢ ĐỊNH]` cho số ngoài DB) → export ở `plugins/.../src/index.ts` → `host.register(...)` trong `apps/thermal-runtime/src/runtime.ts` (SAU các model nó phụ thuộc) → thêm tag vào `recordedTags` → thêm màn `D3-<hệ>` trong `graphics/screens.ts` → 1 unit test (plugin) + 1 integration test (runtime) → GĐ mới. Cập nhật cả `docs/dashboard/twin.html` (redeploy artifact) để hiện lên màn hình.

## 7. CÒN LẠI / HẠNG MỤC MỞ (đều cần dữ liệu/hạ tầng THẬT — ngoài phạm vi mô phỏng)

- **M-06 (quan trọng):** calibrate enthalpy chu trình để **hiệu suất net ~33% → 39%** thiết kế (heat rate đơn vị ~10.900 → 9.200 kJ/kWh). Hằng số enthalpy hiện là `[GIẢ ĐỊNH]` bảo thủ (GĐ-66/68/73); **cân bằng năng lượng vẫn khép ~100%** (nhất quán nội bộ) — chỉ chênh tuyệt đối với thiết kế. Cần **heat balance nhà chế tạo**.
- **M-02/M-03:** đối chiếu KKS breadth ↔ VGB-B 106 · xác nhận FGD với chủ đầu tư.
- **Physics riêng cho hệ "(breadth)"**: soot blower · fuel oil · PA fan · turbine bypass · switchyard · diesel · UPS · DM plant · dosing · air · fire · HVAC (hiện có **tag danh mục sống** qua `registry-sim`, chưa mô hình vật lý riêng — dùng khuôn mẫu §6).
- **Chiều sâu**: AVR/kích từ + bảo vệ ANSI · per-heater + drain cascade · fouling/air-ingress · CEMS Hg/CO · **bảng hơi enthalpy thật** (thay hằng số).
- **v2**: AI RAG/LLM thật · Report designer + xuất PDF/Excel · Event Log lọc/lưu bền · Engineering Engine đầy đủ.
- **v3**: OPC-UA/Modbus thật · CMMS · ML predictive.
- **Dashboard** (`docs/dashboard/twin.html`) có thể mở rộng: trend thời gian thực · nhiều màn/điều hướng · faceplate popup · replay.
- **Kiểm định bên thứ ba (FAT/SAT).**

## 8. BẪY ĐÃ GẶP (gotchas)

- **Server ESM:** `node dist/server.js` (tsc) **lỗi** `ERR_MODULE_NOT_FOUND` (import thiếu đuôi `.js`). Đã sửa bằng script `serve` = **esbuild bundle → `dist/server.mjs`** (đừng quay lại `node dist/server.js`). Bundle là artifact, `.gitignore`, không commit.
- **`node dist/index.js` của packages cũng vậy** — chạy runtime qua `serve`, chạy test qua vitest (esbuild).
- **exactOptionalPropertyTypes OFF** → gán `prop: undefined` được chấp nhận; nhưng `noUncheckedIndexedAccess` ON → index trả `T | undefined`, phải guard.
- **RBAC:** Operator KHÔNG có `override`; `override/setpoint/mode` = TWO_STEP; `engineer` = single-step Engineer+. Chạy SFC live / reset C&E dùng action `engineer`.
- **mcp__github__ tools hay rớt** giữa các lượt — nạp lại qua ToolSearch `select:mcp__github__create_pull_request,mcp__github__merge_pull_request`.
- **Không mở được cổng public** từ container phiên web → localhost:8080 chỉ chạy trên máy người dùng (hoặc trong container để tự kiểm chứng).
- **Đừng revert** `docs/overview/index.html` hay các file dashboard đã chỉnh.

## 9. VIỆC GỢI Ý TIẾP (chọn theo yêu cầu người dùng)

Người dùng vừa yêu cầu **chạy trực tiếp localhost:8080** (đã xong) và muốn **cập nhật lên màn hình khi build thêm**. Hướng tiếp hợp lý:
- (a) Mở rộng dashboard/HMI: **trend thời gian thực**, điều hướng nhiều màn, faceplate popup.
- (b) Thêm physics BoP còn thiếu (khuôn mẫu §6) — giá trị-thêm hẹp dần.
- (c) M-06 calibrate — chỉ làm được khi có heat balance thật.

Luôn kết thúc mỗi phiên/PR bằng khối trạng thái 6 mục (§6.6) và hỏi `[CẦN QUYẾT ĐỊNH]` trước khi sang việc lớn kế.
