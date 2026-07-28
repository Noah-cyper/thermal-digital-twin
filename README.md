# IDTP — Industrial Digital Twin Platform

Nền tảng Digital Twin công nghiệp **kernel + plugin** ("mọi nhà máy chỉ là một plugin").
Plugin #1 = `thermal-power-600` — nhà máy nhiệt điện than **600 MW** (subcritical, drum-type, reheat).

- **12 mô hình mô phỏng** khép **cân bằng năng lượng toàn nhà máy** (than → điện → nhiệt thải → ống khói).
- **99 màn hình** HMI khai báo (JSON), stream WebSocket delta-only, alarm ISA-18.2, faceplate, replay, OTS.
- **232 test** · build 7/7 · CI trên mỗi push/PR.

---

## ▶️ Chạy nhanh — SCADA/HMI tại `http://localhost:8080`

**Yêu cầu:** Node ≥ 20 và pnpm 9.7.0.

```bash
# (nếu chưa có pnpm)  corepack enable  # hoặc: npm i -g pnpm@9.7.0

pnpm install
pnpm --filter @idtp/app-thermal-runtime serve
```

Mở trình duyệt: **http://localhost:8080**

Lệnh `serve` bundle server (esbuild) rồi chạy — vòng CCS + mô phỏng sống + WebSocket đều lên cùng cổng.
Đổi cổng: `PORT=3010 pnpm --filter @idtp/app-thermal-runtime serve` → http://localhost:3010

> Server tự đăng nhập vai **Operator** khi kết nối. Người dùng demo (mật khẩu `p`):
> `viewer` · `operator` · `supervisor` · `engineer` · `maint` · `admin` — đủ minh hoạ RBAC 6 vai.

### Trên HMI anh làm được gì
- **Màn hình process** (D1 tổng quan · D3 lò/turbine/điện/bình ngưng…): giá trị sống, render generic theo JSON.
- **Điều khiển** (RBAC + xác nhận 2 bước + audit): đặt tải, đổi mode loop (MAN/AUTO/CASCADE), ACK alarm.
- **OTS**: Freeze · Snapshot/Restore · tiêm malfunction (rò ống lò, mất chân không, trip mill).
- **Alarm** ISA-18.2 (deadband + delay), **faceplate** 4 tab, **Cause & Effect** (MFT/turbine trip), **SFC** live.
- **Historian/Replay** (tua lại), **Report ca**, **Event Log/SOE**, **System Diagnostic**, **AI Advisor**, **Screen Builder**.

---

## 🖥️ Dashboard tự chứa (không cần cài gì)

`docs/dashboard/twin.html` — digital twin chạy client-side (sơ đồ công nghệ sống, cân bằng năng lượng,
alarm, điều khiển tải/sự cố). Mở trực tiếp file trong trình duyệt, hoặc xem bản artifact đã publish.

---

## 🧱 Build · Test

```bash
pnpm build     # tsc toàn workspace (7/7)
pnpm test      # vitest (232 test)
pnpm typecheck # tsc --noEmit
```

Workspace pnpm + Turborepo: `apps/*` · `packages/*` (kernel, sdk, engines) · `plugins/*`.

## 🗄️ Historian TimescaleDB (tuỳ chọn)

Mặc định dùng historian bộ nhớ (không cần DB). Để chạy với TimescaleDB thật:

```bash
docker compose up -d   # Timescale 2.17-pg16 (xem docker-compose.yml, docs/benchmark.md)
```

`TimescaleHistorian` đạt mốc ghi ≥ 50.000 điểm/s (benchmark: `packages/engines` loadgen).

## 📚 Tài liệu

Bộ tài liệu thiết kế **00–25** trong `docs/` (kiến trúc, tag registry, alarm, control narrative, mô phỏng,
HMI, API, bảo mật IEC 62443, engine specs, phân tích công nghệ 45 hệ…) + `docs/annex-A-thermal-design-basis.md`
(Design Basis 600 MW) + `docs/25-assumptions-open-issues.md` (sổ `[GIẢ ĐỊNH]` + vấn đề mở).

## Kiến trúc

Kernel generic chạy dữ liệu plugin khai báo → thêm nhà máy mới = thêm plugin, **không sửa kernel**.
Plugin runtime chỉ import `@idtp/sdk`. Không `Math.random` cho dữ liệu process; AI/nhật ký/chẩn đoán
**read-only**; mọi lệnh ghi có audit + xác nhận 2 bước.
