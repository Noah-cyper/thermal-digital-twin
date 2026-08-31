# WORKFLOW — Quy trình LÀM & KIỂM SOÁT (IDTP)

> Tài liệu bắt buộc cho MỌI phiên làm việc (mọi tài khoản/agent). Đọc trước khi gõ dòng code đầu tiên.

## 0. Vì sao có tài liệu này — 3 sự cố THẬT đã xảy ra

| Sự cố | Hậu quả | Điều khoản chặn |
|---|---|---|
| Việc chưa commit khi container/nhánh đổi | **MẤT trắng** (panel mô tả hệ thống) | §4 luật vàng: chưa push = chưa xong |
| Working copy nằm SAI nhánh (`idtp-scope-phase-0` cũ) trong khi việc thật ở `doc-analysis` | Làm trên nền cũ, tưởng mất hết | §2 nghi thức mở phiên |
| Nói "xong" khi KHÔNG tự kiểm chứng được (HMI không chụp được) | Ship mù, tốn công đôi | §5 ma trận kiểm chứng |

---

## 1. Nhánh — chốt một lần

- **Trunk DUY NHẤT: `claude/doc-analysis-lna6sz`** — nơi chứa 100% công việc và là nguồn deploy web.
- Nhánh khác (kể cả nhánh ghi trong prompt hệ thống) **không dùng** trừ khi chủ dự án đổi bằng văn bản.
- Commit **TRỰC TIẾP** lên trunk (không PR). Nhiều tài khoản dùng chung → xem §9.

## 2. Nghi thức MỞ PHIÊN (bắt buộc, ~1 phút)

```bash
git checkout claude/doc-analysis-lna6sz
git pull --rebase origin claude/doc-analysis-lna6sz
pnpm install                 # container mới BẮT BUỘC (thiếu → build fail giả)
pnpm build                   # phải 9/9
pnpm test                    # baseline xanh — ghi lại số test
git status --porcelain       # phải RỖNG
```

**Chỉ khi 5 dòng trên sạch mới được bắt đầu.** Báo baseline cho chủ dự án:
`nhánh @ <sha> · build 9/9 · test <n> xanh · GĐ mới nhất <n>`

## 3. Đơn vị công việc — 1 việc = 1 commit

- Nhỏ, tự đứng được: **một** model / **một** màn / **một** seam / **một** sửa lỗi.
- Trần: > 5 file nguồn hoặc > ~40 phút → **chẻ nhỏ** trước khi làm.
- **Không gộp** nhiều tính năng rồi mới commit một lần.

## 4. ĐỊNH NGHĨA XONG (DoD) — thiếu 1 mục = CHƯA XONG

1. `pnpm build` → **9/9**
2. `pnpm test` xanh **và** có test MỚI cho hành vi mới
3. Kiểm chứng theo **§5** (đủ bằng chứng)
4. Ghi `docs/25` — mục GĐ mới (newest ở ĐẦU bảng, số tăng dần)
5. **`git pull --rebase` → `git commit` → `git push`** lên trunk
6. Báo cáo theo mẫu **§6**

> ### ⚠️ LUẬT VÀNG
> **Chưa push = chưa xong.** Container là *ephemeral* — mất điện/đổi nhánh là mất trắng.
> **Tuyệt đối không để việc chưa commit qua lượt trả lời.** Xong tới đâu, push tới đó.

## 5. Ma trận KIỂM CHỨNG — bằng chứng nào mới được nói "xong"

| Loại thay đổi | Bằng chứng BẮT BUỘC |
|---|---|
| Sim / engine / logic | Unit test mới + toàn bộ suite xanh |
| Tag & màn hình khai báo | Screen-tag validation xanh + build 9/9 |
| **Hiển thị HMI (nhìn thấy)** | Ảnh chụp headless. **Không chụp được → ghi `CHỜ XÁC NHẬN`, CẤM nói "xong"** |
| **Lên web thật** | **Chỉ chủ dự án xác nhận được** (proxy chặn domain) — CẤM tự nói "đã lên web" |
| Hạ tầng cần credential | Chỉ dựng seam + ghi rõ "chưa kết nối, không bịa dữ liệu" |

**Quy tắc trung thực:** không tự kiểm chứng được thì nói thẳng *"em không kiểm được, cần anh xác nhận"* — không suy đoán, không nói giảm.

## 6. Mẫu BÁO CÁO sau mỗi đơn vị (ngắn, cố định)

```
[XONG] <việc>  ·  commit <sha>
Kiểm chứng: build 9/9 · test <n> xanh · <ảnh | CHỜ ANH XÁC NHẬN>
docs/25: GĐ-<n>
Kế tiếp: <việc sau>
```

Phản hồi dài kết bằng khối:
`TRẠNG THÁI / ĐÃ XONG / GIẢ ĐỊNH MỚI / XUNG ĐỘT–RỦI RO / CẦN QUYẾT ĐỊNH / BƯỚC TIẾP THEO`

## 7. KIỂM SOÁT của chủ dự án — 30 giây

```bash
git log --oneline -10                                   # đã làm gì
git status --short                                      # còn gì dở (phải rỗng)
git rev-list --count origin/claude/doc-analysis-lna6sz..HEAD   # còn gì CHƯA push (phải 0)
```

**3 nguồn sự thật** (không tin lời kể):
1. `git log` — đã làm gì thật
2. `docs/25` — vì sao + giả định + kiểm chứng
3. **Web** — thấy tận mắt

**Chốt chặn:** chủ dự án duyệt/redirect sau **mỗi đơn vị** (§6). Đây là điểm kiểm soát.

## 8. Chế độ "LÀM MỘT MẠCH" (chạy dài không hỏi)

Được phép, nhưng:
- **Vẫn giữ DoD từng đơn vị** — commit + push TỪNG việc. Chỉ gộp phần *báo cáo* ở cuối. **Không gộp commit.**
- **DỪNG NGAY** khi: test đỏ · không kiểm chứng được · phải đoán ý chủ dự án · chạm credential/bảo mật · phải sửa file của tài khoản khác.

## 9. Luật TRUNK CHUNG (nhiều tài khoản song song)

- `git pull --rebase` trước **mỗi** commit.
- **Không revert/ghi đè** file tài khoản khác đang sửa — merge, đừng đè.
- `docs/25`: GĐ mới ở **ĐẦU** bảng, số **tăng dần**, không trùng.
- Commit nhỏ, message rõ (`feat(scope): …` / `fix(scope): …`).

## 10. Luật cứng kế thừa (CLAUDE.md — vi phạm = hỏng)

Không `Math.random`/`Date.now` trong vòng sim · không stub/TODO · màn hình là JSON khai báo (kernel render) ·
AI **read-only tuyệt đối** · alarm có deadband+delay · số ngoài Design Basis → `[GIẢ ĐỊNH]` + ghi `docs/25` ·
không bịa API/SDK/credential của bên thứ ba.

## 11. VIỆC ĐANG TREO (cập nhật mỗi phiên)

| Trạng thái | Việc | Ghi chú |
|---|---|---|
| ❌ MẤT | Panel mô tả hệ thống ("màn tự giải thích": Mục đích · Nguyên lý ĐK · Thiết bị · Đo) | Chưa commit khi đổi nhánh → phải làm LẠI |
| ⏳ CHỜ | Xác nhận trunk chính thức = `claude/doc-analysis-lna6sz` | Prompt hệ thống ghi nhánh khác (đã cũ) |
| ⏳ CHỜ | Xác nhận web thật đã cập nhật | Chỉ chủ dự án kiểm được |
