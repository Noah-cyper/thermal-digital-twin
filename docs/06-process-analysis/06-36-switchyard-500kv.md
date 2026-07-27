# 06‑36 — Switchyard 500 kV (Electrical)

> 13 mục §10. Neo Design Basis §3.1 (500 kV). IEC 61850 = v3.

| # | Mục | Nội dung |
|---|---|---|
| 1 | Chức năng | Đấu nối 500 kV lên lưới; bay control, synchro‑check, auto‑recloser |
| 2 | Nguyên lý | 500 kV bays (breaker‑and‑a‑half `[GIẢ ĐỊNH]`), breakers, disconnectors, CT/VT; protection & control IEC 61850 (v3); synchro‑check khi đóng |
| 3 | Thiết bị | 500 kV breakers, disconnectors, earthing switch, CT/VT, lightning arrester |
| 4 | Instrument | Bus voltage, line current, breaker/disconnector status, sync variables |
| 5 | PLC/DCS | Substation automation (IEC 61850, v3); bay control unit |
| 6 | Interlock/Trip | **Breaker–disconnector interlock**; **synchro‑check trước khi đóng**; auto‑recloser; bus/line protection |
| 7 | Alarm | `SWY-BAY1-BKR-TRIP` P1 · bus undervoltage P1 · protection operate P1 |
| 8 | Trend | bus voltage, line current, P/Q xuất tuyến |
| 9 | Faceplate | Breaker control (open/close + synchro‑check + lý do interlock) |
| 10 | Tag | `SWY_500_BUS_VOLT_01` (kV) · `SWY_500_BAY1_BKR_STATUS_01` (bool) · `SWY_500_LINE1_CURR_01` (A) |
| 11 | Animation | Single‑line 500 kV: breaker/disconnector đóng‑mở, bus có điện |
| 12 | Sequence | Đóng breaker với synchro‑check; auto‑recloser khi sự cố thoáng qua |
| 13 | SOP | Tuân interlock đóng cắt; synchro‑check bắt buộc; kiểm auto‑recloser |

**Định mức:** 500 kV / 50 Hz.
