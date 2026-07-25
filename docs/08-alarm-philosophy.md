# 08 — Alarm Philosophy & Rationalization

> Tài liệu #08/00–25 (§14). ISA‑18.2 / EEMUA 191. State machine & shelving: **doc 05‑03**. Alarm ids
> khớp doc 06/07. Chốt: triết lý · priority · rationalization · **template + roll‑up ≥ 600 alarm** · mẫu YAML.

## 1. Nguyên tắc (EEMUA 191)
- Mỗi alarm **phải hành động được**: có cause · consequence · corrective action · **deadband + delay**.
- Alarm là **tài nguyên hiếm** — không báo cái operator không làm gì được (loại bỏ nuisance).
- Suppression theo trạng thái thiết bị (vd không "low flow" khi bơm dừng).
- Priority theo **hậu quả × thời gian đáp ứng**, không theo cảm tính.

## 2. Priority & thời gian đáp ứng (Phụ lục A §10.2)
| Priority | Ý nghĩa | Đáp ứng | Màu |
|---|---|---|---|
| **P1** Critical | mất an toàn/trip nếu bỏ qua | 30 s | `--alarm-1` #E5484D |
| **P2** High | ảnh hưởng vận hành | 10 phút | `--alarm-2` #F5A524 |
| **P3** Medium | cần chú ý | 30 phút | `--alarm-3` #F5D90A |
| **P4** Low/Diag | tham khảo | ∞ | `--alarm-4` #4C9AFF |

## 3. Chống chattering & chất lượng (đo ở màn hình Diagnostic)
| Chỉ tiêu | Giá trị |
|---|---|
| Deadband · on‑delay · off‑delay | 2–5% dải · 2–5 s · 5–10 s |
| Tần suất ổn định | ≤ 1 alarm/10 phút/operator (~144/ngày) |
| Ngưỡng flood | > 10 alarm/10 phút |
| Phân bố mục tiêu | P1 ≈ 5% · P2 ≈ 15% · P3/P4 ≈ 80% |
| Bad actor | top 10 tag gây nhiều alarm nhất |
| Shelving | ≤ 8 h, tự bung, audit (doc 05‑03) |

## 4. Alarm template theo loại thiết bị (alarm/instance)
| Loại | Alarm chuẩn | ~alarm |
|---|---|---:|
| Motor pump/fan | CURRENT‑HH · DISCH‑LO · BRG‑VIB‑HH · BRG‑TEMP‑HH(×2) · WIND‑TEMP‑HH · TRIP | 7 |
| Mill | OUTLET‑TEMP‑HH · PA‑FLOW‑LO · DP‑HI · SEAL‑AIR‑LO · CURRENT‑HH · BRG‑TEMP‑HH · TRIP | 7 |
| Control loop | PV‑HI · PV‑LO · DEVIATION · FAULT | 4 |
| Transmitter (mức/áp quan trọng) | HH · HI · LO · LL | 2–4 |
| Analyzer | VALUE‑HH · FAULT | 2 |
| Breaker | PROT · TRIP · CURRENT‑HH | 3 |
| Heater/vessel | LEVEL‑HH · LEVEL‑LL · OUT‑TEMP‑HH | 3 |

## 5. Roll‑up số alarm theo khu vực (≥ 600) `[GIẢ ĐỊNH]`
| Khu vực | ~alarm |
|---|---:|
| Boiler Island | 140 |
| Turbine Island | 90 |
| Generator | 40 |
| Electrical | 90 |
| Switchyard 500 kV | 40 |
| Cooling Water | 20 |
| Flue Gas/Emission | 50 |
| Coal Handling | 50 |
| Ash Handling | 30 |
| BoP (fuel oil·WTP·dosing·air·fire·HVAC·diesel·UPS) | 100 |
| **TỔNG** | **~650** |

→ **≥ 600 ✓** (§10). Phân bố kiểm: P1 ~33 (5%) · P2 ~98 (15%) · P3/P4 ~520 (80%).

## 6. Mẫu alarm (YAML)
`docs/08-alarm-registry/boiler-island.sample.alarms.yaml` — theo `AlarmDef` (doc 05‑03).

## 7. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑15 | Alarm/instance theo template (§4) |
| GĐ‑16 | Roll‑up ~650 alarm (§5) — hiệu chỉnh khi rationalization thực |
