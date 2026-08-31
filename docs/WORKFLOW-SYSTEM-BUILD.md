# WORKFLOW-SYSTEM-BUILD — Dựng từng hệ thống tới độ CHI TIẾT NHÀ MÁY THẬT

> Đi kèm `docs/WORKFLOW.md` (quy trình kiểm soát git/DoD). Tài liệu này quy định **cách dựng NỘI DUNG kỹ thuật**.
> Nguyên tắc tối cao: **làm DỨT ĐIỂM một hệ rồi mới sang hệ khác** — không nhảy cóc, không làm dở dang song song.

---

## 0. Ba nguyên tắc

1. **Dứt điểm từng hệ.** Một hệ chỉ được coi là xong khi qua đủ 7 bước (§2) và đóng hết bảng GAP.
2. **Tự soi lỗi trước khi báo.** Chạy checklist §3; tự tìm chỗ thiếu/sai/chưa hợp lý — **không để chủ dự án phát hiện hộ**.
3. **Chuẩn so sánh = nhà máy THẬT**, không phải "đủ chạy demo". Thiếu thiết bị phụ, thiếu điểm đo, sơ đồ không giống P&ID → **chưa xong**.

## 1. Hàng đợi hệ thống (làm từ lõi ra ngoài)

| # | Hệ | Trạng thái |
|---|---|---|
| 1 | Lò hơi (than · gió · lửa · hơi · tái nhiệt) | |
| 2 | Turbine – Máy phát | |
| 3 | Nước cấp – Ngưng – Hồi nhiệt | |
| 4 | Đường khói – Phát thải (SCR/ESP/FGD/CEMS) | |
| 5 | Nước tuần hoàn – Làm mát | |
| 6 | Điện (máy phát → GSU → 500 kV → tự dùng) | |
| 7 | Than – Tro xỉ | |
| 8 | BoP (khí nén · DM · dầu đốt · HVAC · PCCC · diesel/UPS) | |

> Chỉ mở hệ kế tiếp khi hệ hiện tại đã **XONG** (§2 B7). Cập nhật cột trạng thái mỗi lần chốt.

## 2. Bảy bước cho MỖI hệ

### B1 · NGHIÊN CỨU — "nhà máy thật có gì?"
Lập **4 danh mục** trước khi viết code:
- **Thiết bị chính** + cấu hình dự phòng (2×100%, 3×50%, standby…)
- **Thiết bị phụ** thường bị quên: van cô lập, van một chiều, van an toàn/PSV, lọc/strainer, bẫy hơi, khớp giãn nở, đường xả đáy/thông hơi, đường recirc
- **Đo lường**: mỗi thiết bị đo gì, đặt ở đâu, dải, đơn vị
- **Điều khiển & bảo vệ**: vòng ĐK (PV/SP/tác động), cascade/feedforward/split-range, interlock, permissive, điều kiện trip

Nguồn: `annex-A` (design basis) · doc 06 (process) · doc 07 (tag) · doc 09 (control narrative & C&E) · doc 10 (sim model) · chuẩn ISA/IEC/EEMUA · thực tiễn tổ máy **600 MW subcritical, drum-type, reheat**.

### B2 · ĐỐI CHIẾU — bảng GAP
| Nhà máy thật có | Twin đang có | Thiếu / Sai / Chưa hợp lý |
|---|---|---|

→ Bảng này **là danh sách việc**. Không có GAP rõ ràng thì chưa được dựng.

### B3 · THIẾT KẾ
- **Cây thiết bị (ISA-95)**: Hệ → Phân hệ → Thiết bị → Điểm đo
- **Tag**: đặt tên theo doc 07, có đơn vị + dải; số ngoài design basis → `[GIẢ ĐỊNH]` + ghi `docs/25`
- **Màn hình**: bố cục **theo dòng chảy công nghệ như P&ID** (không phải bảng số xếp hàng)

### B4 · DỰNG
sim model (ADDITIVE, tất định) → tag → vòng điều khiển → alarm (deadband + delay) → màn khai báo JSON → nav/drill nhiều lớp.

### B5 · TỰ KIỂM — chạy checklist §3 (**bắt buộc**)
Mỗi mục KHÔNG đạt → ghi ngược vào bảng GAP → sửa → kiểm lại. Chỉ sang B6 khi sạch.

### B6 · LÀM ĐẸP (giống HMI nhà máy thật)
- Bố cục theo dòng chảy; ống **tô màu theo môi chất** (hơi/nước/khói/gió/điện/than/tro)
- **Ký hiệu đúng loại**: bơm/quạt = tròn, turbine = hình thang, MBA = 2 vòng tròn, bao hơi = bo tròn, ống khói, bình ngưng…
- Nhãn + đơn vị đầy đủ; **màu chỉ đổi khi bất thường** (ISA-101 — bình thường trung tính)
- **Không**: ô chết, NaN/undefined, thiết bị chồng lấn, tag không sống, nav gãy

### B7 · XONG
Theo **DoD của `WORKFLOW.md`**: build 9/9 · test xanh (+test mới) · đủ bằng chứng kiểm chứng · ghi `docs/25` · **commit + push** · báo cáo.
Kèm **hồ sơ hệ thống** (§4). Rồi mới mở hệ kế tiếp.

---

## 3. CHECKLIST TỰ KIỂM (B5) — 7 nhóm

**① Đủ thiết bị?**
- Thiết bị chính đủ chưa? Cấu hình dự phòng đúng chưa (2×100% / 3×50% / standby)?
- Thiết bị phụ: van cô lập · một chiều · an toàn/PSV · lọc · bẫy hơi · giãn nở · xả đáy · thông hơi · recirc?

**② Đủ đo lường?** (theo loại thiết bị — xem §5)
- Thiết bị quay có đủ **rung + nhiệt gối + dòng motor** chưa?
- Bình/bể có đủ **mức + áp + nhiệt** chưa? Đường ống chính có **lưu lượng + áp + nhiệt** chưa?
- Bộ trao đổi nhiệt có **nhiệt vào/ra hai phía + ΔP + TTD** chưa?

**③ Điều khiển đúng nguyên lý?**
- Đúng PV/SP? Tác động **thuận hay nghịch** (reverse) có đúng vật lý không?
- Chỗ nào cần **cascade / feedforward / split-range / override** — đã có chưa?
- Vòng có thực sự **đóng** không (model đọc được OP và phản hồi lại PV)?

**④ Bảo vệ đủ?**
- Điều kiện **trip** · **permissive** khởi động · **interlock** liên động?
- Bảo vệ đặc thù: min-flow bơm · anti-surge quạt · mức cao/thấp · quá nhiệt · quá áp?

**⑤ Số liệu hợp lý?**
- So với **design basis** (annex-A) — đúng dải vận hành chưa?
- **Đơn vị** đúng? **Cân bằng khối lượng / năng lượng** có khớp không?
- Số ngoài design basis đã gắn `[GIẢ ĐỊNH]` + ghi `docs/25` chưa?

**⑥ Sơ đồ giống nhà máy thật?**
- Dòng chảy đi đúng thứ tự công nghệ? Có thiếu nhánh/van chính không?
- Ký hiệu đúng loại thiết bị? Có nhãn + đơn vị? Bố cục đọc được?

**⑦ Nhất quán?**
- Tên tag theo chuẩn? Drill/nav không gãy? `docs/25` đã ghi? Không phá màn/hệ khác (0 hồi quy)?

---

## 4. Hồ sơ hệ thống (nộp cùng mỗi hệ khi chốt)

1. Danh mục **thiết bị** (chính + phụ + dự phòng)
2. Danh mục **điểm đo** (tag · đơn vị · dải)
3. Danh mục **vòng điều khiển + bảo vệ/interlock**
4. **Bảng GAP đã đóng** (thật có / twin có / đã sửa gì)
5. **Ảnh màn hình** — hoặc ghi rõ `CHỜ CHỦ DỰ ÁN XÁC NHẬN` nếu không tự chụp được
6. Số **GĐ** trong `docs/25`

---

## 5. CHUẨN THIẾT BỊ THEO LOẠI — dùng cho B1 & checklist ②

| Loại | Thiết bị phụ đi kèm | Điểm đo tối thiểu |
|---|---|---|
| **Bơm** (BFP/CW/CEP) | van hút/đẩy, van một chiều, lọc, recirc min-flow, hệ làm mát/chèn | lưu lượng · áp hút · áp đẩy · **rung** · **nhiệt gối** · dòng motor · NPSH |
| **Quạt** (FD/ID/PA) | damper/IGV, van cô lập | lưu lượng · cột áp · dòng · **rung** · **biên surge** |
| **Bình/bể** (bao hơi, khử khí, hotwell) | van an toàn, thông hơi, xả đáy, kính mức | **mức** (nên 2 phép đo) · áp · nhiệt |
| **Bộ trao đổi nhiệt** (gia nhiệt, bình ngưng) | van drain/vent, đường bypass | nhiệt vào/ra **hai phía** · ΔP · **TTD** · mức ngưng |
| **Turbine** | van stop/control, hơi chèn, hệ dầu bôi trơn | tốc độ · **rung + nhiệt gối** · áp/nhiệt dầu · chân không · **TSE ứng suất** |
| **Máy phát** | kích từ, làm mát H₂/stator, dầu chèn | MW · MVAr · V · I · tần số · nhiệt stator · áp/nhiệt H₂ · **bảo vệ ANSI** |
| **Máy nghiền** | feeder, phân ly, gió sơ cấp nóng/lạnh | tải · nhiệt ra · ΔP · độ mịn · trạng thái chạy |
| **Đường ống chính** | van cô lập, van an toàn, giãn nở | lưu lượng · áp · nhiệt |

---

## 6. Ranh giới trung thực (kế thừa `WORKFLOW.md` §5)

- Không tự chụp/kiểm được phần hiển thị → ghi **`CHỜ CHỦ DỰ ÁN XÁC NHẬN`**, **cấm** nói "xong".
- Không xác nhận được web thật → **cấm** nói "đã lên web".
- Không bịa số ngoài design basis (phải `[GIẢ ĐỊNH]` + `docs/25`), không bịa API/thiết bị không có thật.
