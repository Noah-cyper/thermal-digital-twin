# 27 — Calibration Playbook (M-06: hiệu suất 33% → 39%)

> Tài liệu THỦ TỤC (không phải governing). Mục tiêu: khi có **heat balance nhà chế tạo**, đội kỹ thuật
> thực thi retune theo đúng thứ tự dưới đây — biến M-06 từ "việc mở, rủi ro" thành "shovel-ready".
> Nguyên tắc bất di: **KHÔNG ép số** bằng cách tweak 1 hằng số đơn lẻ (đã chứng minh vỡ điểm vận hành).

## 1. Vấn đề (đo được, đã khu biệt)
- Hiện: hiệu suất net **~33 %** · heat rate đơn vị **~11.000 kJ/kWh** (mốc thiết kế: **39 % / 9.200**).
- **Cân bằng năng lượng vẫn khép ~100 %** → mô hình NHẤT QUÁN NỘI BỘ; chỉ chênh tuyệt đối với thiết kế.
- **Khu biệt (CalibrationModel, GĐ-93 + c-2):** độ lệch các điều kiện hơi/chân không ĐƯỢC ĐIỀU KHIỂN
  (`PLANT_CAL_MST/HRH/MSP/VAC_DEV`) ≈ 0 → sim ở ĐÚNG điểm hơi thiết kế (541 °C / 541 °C / 17,5 MPa / 5,4 kPa).
  ⇒ Gap KHÔNG do sai điều kiện hơi, mà do **hằng số chuyển hoá nhiên liệu→công** (coal→steam enthalpy→MW)
  đang là `[GIẢ ĐỊNH]` bảo thủ (GĐ-32 `DH_EVAP`, GĐ-66/68/73 enthalpy/heat-rate).

## 2. Vì sao KHÔNG tweak 1 hằng số (bằng chứng)
Đã THỬ `DH_EVAP` 2758 → 2340 (GĐ-32): áp hơi sập ~8 MPa · cân bằng NL vỡ · ~10 test sub-model đỏ · trip
giả → **hoàn tác**. Lý do: 33 % gắn chặt vào điểm vận hành CCS (coal ~211 t/h @ 448 MW), seed/gain 25 vòng,
và ngưỡng mọi sub-model. Sửa đúng = **tái dẫn xuất TOÀN BỘ điểm vận hành**, không phải chỉnh cục bộ.

## 3. Đầu vào bắt buộc (gate)
Heat balance nhà chế tạo (Mollier/heat balance diagram) tại ≥ các mức tải (100/75/50 %):
enthalpy hơi tại mỗi state (MS · CRH · HRH · các điểm trích · xả LP) · công từng thân HP/IP/LP ·
hấp thụ nhiệt lò (SH/RH/econ/evap) · phân tích tổn thất lò (khói khô, ẩm, chưa cháy, bức xạ).
**Không có tài liệu này → KHÔNG bắt đầu §4** (sẽ lại là bịa số).

## 4. Thủ tục retune (đúng thứ tự — mỗi bước build+test xanh trước khi sang bước sau)
1. **Bảng enthalpy thật.** Thay hằng số enthalpy [GIẢ ĐỊNH] (GĐ-32/66/68/73) bằng giá trị từ heat balance
   (hoặc bảng hơi IAPWS-IF97 nội suy tại state thật). Đặt trong `boiler-island.ts` / `turbine-generator.ts` /
   `reheat-cycle.ts` — KHÔNG rải rác.
2. **Tái dẫn xuất điểm vận hành 600 MW.** Từ enthalpy mới: công turbine tổng → hơi BMCR → hấp thụ lò →
   **coal flow cho 600 MW @ 9.200 kJ/kWh** (kỳ vọng coal đầy tải giảm so với hiện tại). Ghi lại điểm mới
   (coal · áp · nhiệt · lưu lượng hơi · net MW) làm "operating point v2".
3. **Warm-start + seed/gain.** Cập nhật `warmStart` (`runtime.ts`) và `boilerLoopSeeds` (25 vòng) về điểm v2
   để MAN→AUTO bumpless. Giữ luật ổn định (process gain × kp < 1 / thêm quán tính nếu cần).
4. **Ngưỡng sub-model test (~10).** Cập nhật các test neo điểm cũ (coal ~211, áp/nhiệt/lưu lượng, heat rate
   feedwater < 9.200, closure) sang điểm v2. Danh sách nghi vấn: `boiler-island` · `feedwater-train` ·
   `plant-balance` · `turbine-generator` · `reheat-cycle` · `condenser-cw` · `coal-handling` · `calibration`.
5. **Kiểm hội tụ mục tiêu.** `PLANT_NET_EFF_01` → ~39 % · `PLANT_UNIT_HR_NET_01` → ~9.200 ·
   `PLANT_CAL_HR_DEV_01`/`PLANT_CAL_EFF_DEV_01` → ~0 · `PLANT_ENERGY_CLOSURE_01` giữ ~100 % ·
   điều kiện hơi (`PLANT_CAL_MST/HRH/MSP/VAC_DEV`) vẫn ≈ 0. Toàn bộ suite xanh (không tụt số test).
6. **Chốt.** Cập nhật M-06 (doc 25) → ✔ + ghi GĐ hiệu chỉnh mới; cập nhật `docs/status/completion-report.html`
   và dashboard nếu số hiển thị đổi.

## 5. Tiêu chí nghiệm thu (Definition of Done cho M-06)
- Hiệu suất net 38–40 % · heat rate đơn vị 9.000–9.400 kJ/kWh tại đầy tải.
- Cân bằng năng lượng khép 98–102 %; mọi độ lệch `PLANT_CAL_*_DEV` trong dung sai.
- 0 hồi quy chức năng (trip/interlock/alarm/OTS như cũ); toàn bộ test xanh.
- Số hiệu chỉnh có nguồn (heat balance) — KHÔNG còn `[GIẢ ĐỊNH]` cho enthalpy lõi.

## 6. Ranh giới (đến khi có §3)
Giữ **33 % trung thực** (M-06 QĐ v1/C1). CalibrationModel + màn D2-calibration ĐÃ phơi bày độ lệch minh
bạch cho vận hành/đánh giá. Với digital twin, số suy ra nhất quán nội bộ > số cosmetic đúng nhãn nhưng vỡ vật lý.
