# 06‑21 — Generator + Excitation (Generator)

> 13 mục §10. Neo Design Basis §3.3 (667 MVA, 20 kV, cos φ 0,9, H₂‑cooled). **Protection ANSI → doc 09.**

| # | Mục | Nội dung |
|---|---|---|
| 1 | **Chức năng** | Biến cơ năng → điện; cấp P/Q; kích từ giữ điện áp đầu cực |
| 2 | **Nguyên lý** | Đồng bộ 3.000 rpm/50 Hz; **H₂‑cooled stator water‑cooled**; excitation (AVR) điều áp/Q; sync‑check khi hoà lưới |
| 3 | **Thiết bị** | Stator, rotor, exciter/AVR, H₂ cooling + seal oil, stator water cooling, **GSU 20/500 kV 720 MVA**, UAT 20/6,6 kV 2×50 MVA |
| 4 | **Instrument** | MW, MVAr, stator V/I, field V/I, stator temp, H₂ pressure/purity, bearing vib |
| 5 | **PLC/DCS** | AVR/excitation control + generator protection |
| 6 | **Interlock/Trip (ANSI §6.4)** | 87G · 87T · 40 (loss of field) · 46 · 32 (reverse power) · 21 · 51V · 59 · 27 · 81O/U · 64F · 24 → **C&E doc 09** |
| 7 | **Alarm** | `GEN-STATOR-TEMP-HH` P1 · `GEN-H2-PURITY-LO` P2 · `GEN-FIELD-CURR-HH` P2 · MVAr limit P3 |
| 8 | **Trend** | MW, MVAr, stator temp, field current, H₂ pressure |
| 9 | **Faceplate** | Excitation/AVR (voltage/Q) + sync scope |
| 10 | **Tag** | `GEN_MW_01` · `GEN_MVAR_01` · `GEN_STATOR_TEMP_03` (°C) · `GEN_FIELD_CURR_01` (A) · `GEN_H2_PURITY_01` (%) |
| 11 | **Animation** | Generator running (xanh); sync scope; breaker status |
| 12 | **Sequence** | Sync (khớp V/f/pha) → đóng breaker → nhận tải; nạp H₂; excitation on |
| 13 | **SOP** | **Sync‑check trước khi đóng**; giữ cos φ 0,9; giám sát stator temp & H₂ purity |

**Số vận hành định mức:** 667 MVA · 20 kV · cos φ 0,9 · GSU 20/500 kV YNd11 · UAT 20/6,6 kV.
