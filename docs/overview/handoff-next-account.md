# Handoff — tiếp tục IDTP (cho tài khoản/phiên khác)

> Prompt bàn giao. Phiên mới KHÔNG có ký ức phiên trước → đọc file này + các doc được trỏ, rồi làm tiếp.

## 0. Repo & branch
- Repo: `Noah-cyper/thermal-digital-twin`
- Branch tiếp tục: **`claude/idtp-scope-phase-0-y2fxa7`** (pull mới nhất; làm tiếp trên chính branch này).
- Commit gần nhất: walking skeleton chạy được (`fd74765`).

## 1. ĐỌC TRƯỚC (bắt buộc)
1. `CLAUDE.md`
2. `docs/00-master-prompt.md` (prompt cha) + `docs/annex-A-thermal-design-basis.md` (Design Basis 600 MW)
3. Lướt `docs/00..25` (bộ thiết kế đã DUYỆT) — đặc biệt: 04 asset/UNS · 07 tag · 08 alarm · 09 C&E · 10 sim · 11 palette.
4. `docs/overview/index.html` (status board) · `docs/overview/product-vision.html` (sản phẩm là gì).

## 2. TRẠNG THÁI HIỆN TẠI
- **Tài liệu 00–25: XONG & đã duyệt** (được phép viết code).
- **Code Pha A (W1–W4) XONG**, 35 test pass:
  - `packages/sdk` (@idtp/sdk): types + manifest Zod + 8 interface.
  - `packages/kernel` (@idtp/kernel): 8 module L1 (Time · EventBus · Namespace/UNS · Audit · AssetModel · ConfigStore · DataContract · PluginLoader).
  - `packages/engines` (@idtp/engines): Tag/Realtime · Control PID · Simulation host · Graphics binding.
  - `plugins/thermal-power-600`: `DrumModel` (ISimModel, chỉ import @idtp/sdk).
  - `apps/walking-skeleton`: WS server + màn hình SVG (sim→PID→tag→WS→screen.json).

## 3. VERIFY TRƯỚC KHI LÀM (phải xanh)
```bash
git pull
pnpm install
pnpm build      # 5 package build sạch
pnpm test       # 35 test pass
pnpm -F @idtp/app-walking-skeleton start   # http://localhost:8080 — drum nhúc nhích
```

## 4. VIỆC TIẾP THEO — hoàn tất lát cắt 12 tuần (doc 24)
**Pha B (W5–7): sim Boiler Island rộng + loop + Graphics**
- Mở rộng sim trong `plugins/thermal-power-600`: combustion (coal→heat→steam), main steam pressure (τ/θ doc 10), O₂, thêm state; giữ swell/shrink.
- Thêm control loop (doc 09 §1): Boiler master · Fuel master · Air/O₂ trim · Furnace draft · Main steam pressure · SH temp — dùng `PidController` (đã có anti-windup/bumpless).
- Graphics: thêm màn hình D1 Plant Overview + vài D3 (screen.json), render qua binding đã có.

**Pha C (W8–10): Alarm + Historian + RBAC**
- `packages/engines` (hoặc package mới): Alarm Engine ISA‑18.2 (state machine doc 05‑03, deadband + on/off delay, priority P1–P4, shelving ≤8h) — nạp `alarms/*.yaml` (mẫu doc 08).
- Historian + **DATA REPLAY banner tím** (doc 05‑04/19): TimescaleDB (infra/docker) hoặc adapter memory trước; snapshot 5', seek < 2s.
- Security/RBAC 6 vai + audit (doc 05‑07/18): ma trận quyền, JWT, xác nhận 2 bước.

**Pha D (W11–12): plugin #2 + OTS**
- `plugins/water-treatment-demo` (~60 tag, 3 màn hình, 1 PID mức, 8 alarm) — **BÀI TEST GENERIC**: thêm plugin này **KHÔNG sửa 1 dòng** `packages/*` & `apps/*` (kiểm `git diff --stat`).
- OTS cơ bản: freeze/snapshot/restore + 3 malfunction (mill trip · tube leak · loss of vacuum).

## 5. LUẬT CỨNG KHI CODE (vi phạm = hỏng)
- TypeScript strict, **không** `any`/`@ts-ignore`; **không** stub/TODO/code rút gọn; mỗi file compile được.
- **Không** `Math.random()` làm nguồn process (nhiễu có seed).
- Plugin runtime **chỉ** import `@idtp/sdk`; màn hình = **JSON khai báo**, kernel render (không hardcode React).
- Kernel không biết tên plugin cụ thể. Alarm luôn deadband + delay. Lệnh ghi có audit + xác nhận 2 bước. AI read‑only.
- Số ngoài Design Basis → `[GIẢ ĐỊNH]` + ghi `docs/25-assumptions-open-issues.md`.
- Naming/tag/màu theo doc 04/07/08/11 (giữ nhất quán).

## 6. QUY TRÌNH MỖI BATCH (tiết kiệm token)
- Làm 1 khối chạy được → `pnpm build` + `pnpm test` (phải xanh) → commit (Conventional Commits + footer) → `git push -u origin claude/idtp-scope-phase-0-y2fxa7`.
- Footer commit:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Tóm tắt 1–2 dòng/batch; **không** gửi file/publish; cập nhật `docs/overview/index.html` chỉ ở mốc lớn.

## 7. TIÊU CHÍ KẾT THÚC LÁT CẮT (doc 00 §8 / doc 24)
1. Thêm `water-treatment-demo` = 0 dòng sửa `packages/kernel` & `apps/*`.
2. Màn hình 100% JSON khai báo.
3. Chuỗi sim→(MQTT)→historian→WS→HMI khép kín, không `Math.random`.
4. Alarm ISA‑18.2 có deadband + delay + audit.
5. DATA REPLAY banner tím, seek < 2s, đồng bộ màn hình + trend + alarm.
6. RBAC 6 vai + lệnh ghi có audit bất biến + xác nhận 2 bước.
