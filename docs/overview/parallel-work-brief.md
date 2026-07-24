# Phân chia công việc song song — 2 tài khoản (chống xung đột)

> Mục tiêu: 2 phiên/tài khoản chạy song song để tăng throughput cho **doc 06** (process‑analysis,
> file/hệ thống, 13 mục/hệ) **mà không đụng nhau**. Account B đọc file này từ repo.

## 0. Bối cảnh
- Repo: `Noah-cyper/thermal-digital-twin`. Docs 00–05 **đã chốt & push** (branch A).
- **Lane A** (session gốc): branch `claude/idtp-scope-phase-0-y2fxa7`.
- **Lane B** (account thứ 2): branch **riêng** `claude/idtp-scope-phase-0-b`.

## 1. Ba luật cứng chống xung đột
1. **Branch riêng.** B chỉ commit/push lên `claude/idtp-scope-phase-0-b`. Không push vào branch của A.
2. **File rời nhau.** Mỗi lane chỉ tạo/sửa file phần mình. Không sửa file của lane kia.
3. **File chung chỉ A giữ:** `docs/05-engine-specs/README.md`, `docs/06-process-analysis/README.md`,
   `docs/overview/*.html`, `docs/25-assumptions-open-issues.md`. B **không** đụng — nếu B có giả định
   mới thì ghi vào **cuối file hệ thống của B** (mục "Giả định"), A gom sau.

## 2. Chia việc doc 06
Thư mục: `docs/06-process-analysis/`, đặt tên `06-<nn>-<slug>.md`. **Không trùng số nn.**

| Lane | Phạm vi hệ thống | Dải số file |
|---|---|---|
| **A** (Boiler Island) | Steam Drum · Combustion/Furnace · Pulverizer · FD/ID/PA Fans · Air Heater · Economizer · Main Steam · SH/RH Temp Control · Boiler Protection | `06-01` … `06-19` |
| **B** (Turbine + Gen + Electrical + BoP) | Turbine (HP/IP/LP) · Condenser · CEP/BFP/Deaerator/HP‑LP Heaters · Cooling Tower · Generator + Excitation · Electrical Single Line · UAT/GSU · Switchyard 500 kV · Coal Handling · Ash · Fuel Oil · CEMS · Water Treatment · Chemical Dosing · Compressed/Instrument Air · Fire Fighting · HVAC · Diesel Gen · UPS/Battery · Soot Blower | `06-20` … `06-59` |

## 3. Convention BẮT BUỘC (cả 2 lane giống hệt)
- **Đọc trước khi viết:** `CLAUDE.md`, `docs/00-master-prompt.md`, `docs/annex-A-thermal-design-basis.md`,
  và `docs/00..05` (đã chốt). Dùng đúng naming/registry.
- **Naming:** asset/UNS/KKS theo `docs/04-asset-model-uns.md`; fallback name `AREA_SYS_EQUIP_MEAS_NN`;
  KKS chưa chắc → gắn `[GIẢ ĐỊNH]`.
- **13 mục/hệ (§10):** Chức năng · Nguyên lý · Thiết bị · Instrument · Interlock · Alarm · Trend ·
  Faceplate · Tag · Animation · Sequence · SOP · (thông số vận hành định mức).
- **C&E matrix MFT/Turbine trip → để doc 09**, KHÔNG làm ở doc 06 (chỉ nêu Interlock/Sequence từng hệ).
- Số ngoài Design Basis → `[GIẢ ĐỊNH]`. **Không viết code.** Tiếng Việt, thuật ngữ English.
- Màu môi chất / palette theo Phụ lục A §9.4. Alarm priority/deadband/delay theo doc 01/08 convention.
- **Tiết kiệm token:** commit message rõ ràng thay cho status‑block dài; không gửi file/publish.

## 4. Quy trình merge (A chủ trì)
1. B làm xong batch → commit/push lên branch B.
2. A định kỳ: `git fetch origin && git merge origin/claude/idtp-scope-phase-0-b`
   → file rời nhau nên **không conflict**.
3. Khi doc 06 xong: A cập nhật `06-process-analysis/README.md` + `docs/overview/index.html` **một lần**,
   gom `[GIẢ ĐỊNH]` vào doc 25.

## 5. Câu kickoff cho account B (dán vào phiên account B)
> Đọc `CLAUDE.md`, `docs/00-master-prompt.md`, `docs/annex-A-thermal-design-basis.md`, và `docs/00..05`.
> Rồi làm `docs/06-process-analysis/` theo `docs/overview/parallel-work-brief.md` — **Lane B**, trên
> branch `claude/idtp-scope-phase-0-b`. Bắt đầu batch đầu: **Turbine · Generator · Electrical Single Line**
> (file `06-20`, `06-21`, `06-22`). Mỗi hệ đủ 13 mục §10, tách file theo hệ, không đụng file chung.
