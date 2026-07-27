# 10 — Simulation Model

> Tài liệu #10/00–25 (§14). "Ruột" mô phỏng (Phụ lục A §8). Host & vòng đời: doc 05‑05. Loop: doc 09.
> Solver **100 ms**, tách chu kỳ publish. **Không `Math.random()`** — nhiễu có seed. Mọi hằng số dưới
> đây `[GIẢ ĐỊNH]` (không có trong Design Basis) → doc 25; hiệu chỉnh khi tuning.

## 1. Kiến trúc solver
- Step **dt = 100 ms**, tất định (dùng `ctx.now()`), tích phân Euler/RK.
- Publish theo scan class (250/500/1000/5000 ms) — tách khỏi solver.
- Trạng thái: khối lượng/năng lượng các bình + biến loop; snapshot/restore cho replay/re‑sim.

## 2. Cân bằng khối lượng & năng lượng (bình chứa)
**Drum:**
```
dM/dt   = ṁ_fw − ṁ_steam
d(U)/dt = ṁ_fw·h_fw − ṁ_steam·h_steam + Q_riser
P_drum  = f(U, M)         # bảng hơi bão hoà
```
**Condenser hotwell / Deaerator / Bunker:** tương tự `dM/dt = Σṁ_in − Σṁ_out`, năng lượng theo enthalpy.

## 3. Drum level swell/shrink (bắt buộc — dấu hiệu sim thật)
Mức = phần khối lượng nước **+** hiệu ứng thể tích bọt hơi khi áp đổi:
```
L = L_mass(M) + K_swell · (−dP_drum/dt)
```
Tải tăng nhanh → P giảm → bọt nở → **level tăng tạm thời (swell)** dù khối lượng giảm; ngược lại shrink.
`K_swell` `[GIẢ ĐỊNH]`.

## 4. Quán tính bậc 1 + dead time (vòng nhiệt độ/lưu lượng)
```
τ · dy/dt + y = K · u(t − θ)
```
| Đối tượng | τ (s) | θ (s) |
|---|---:|---:|
| Fuel(coal) → steam production | 40 | 20 (mill + cháy) `[GIẢ ĐỊNH]` |
| SH steam temp (spray) | 45 | 15 `[GIẢ ĐỊNH]` |
| RH steam temp | 60 | 20 `[GIẢ ĐỊNH]` |
| Furnace O₂ | 20 | 8 `[GIẢ ĐỊNH]` |
| Main steam pressure | 90 | — `[GIẢ ĐỊNH]` |
| Furnace draft | 3 | 1 `[GIẢ ĐỊNH]` |

## 5. Đường cong bơm/quạt + affinity law
```
Bơm:  H = H0 − a·Q²                 Quạt: ΔP = P0 − b·Q²
Affinity (theo tốc độ N):  Q ∝ N ,  H ∝ N² ,  Power ∝ N³
Damper: hệ số cản k(θ_damper) làm dịch đường đặc tính
```
`H0, a, P0, b` `[GIẢ ĐỊNH]` theo bơm/quạt.

## 6. Đốt cháy → hơi
```
Q_release = ṁ_coal · LHV · η_comb(O₂, load)      # LHV = 21.500 kJ/kg (Design Basis)
ṁ_steam  ∝ Q_release − Q_loss
η_comb   giảm khi O₂ lệch 3,2% hoặc tải thấp
```

## 7. Turbine (Stodola) & Generator
```
Stodola (ellipse):  ṁ ∝ √((p_in² − p_out²)/T_in)
MW = ṁ · Δh · η_mech                # Δh = enthalpy drop HP+IP+LP
Governor: load = f(speed error, droop 4–5%)
Generator: P = MW·η_gen ; Q = f(excitation) ; đồng bộ 3.000 rpm/50 Hz
```

## 8. Nhiễu đo (không "chết cứng")
```
y_meas = y · (1 + noise) + drift(t)
noise ~ seeded, ±0,1–0,3%        drift: chậm, biên nhỏ
```
Seed cố định → replay/re‑sim tái lập.

## 9. PID params khởi điểm (loop doc 09) `[GIẢ ĐỊNH]`
| Loop | kp | ki | kd | Ghi chú |
|---|---:|---:|---:|---|
| Drum level 3‑element | 1,2 | 0,05 | 0 | + feedforward steam/fw flow |
| SH temp (spray) | 0,8 | 0,02 | 0,1 | cascade |
| Main steam pressure | 2,0 | 0,08 | 0 | CCS |
| Furnace draft (ID) | 1,5 | 0,10 | 0 | nhanh |
| Boiler master | 1,0 | 0,03 | 0 | — |
| Turbine governor | droop 4–5% | — | — | speed/load |

Anti‑windup back‑calculation + bumpless (doc 05‑06).

## 10. Kịch bản vận hành (chạy được)
| Kịch bản | Diễn biến kỳ vọng |
|---|---|
| **Cold start → purge → light‑off** | NFPA 85 purge → igniter → mill; áp/nhiệt tăng dần |
| **Sync → ramp 0→600 MW** | hoà lưới → tăng tải theo CCS, không dao động; swell/shrink khi đổi tải |
| **Load change ±5%/phút** | loop giữ áp/nhiệt/mức trong dải |
| **Mill trip → runback** | mất 1 mill → runback giữ tải bằng mill còn lại |
| **MFT → coast down** | cắt nhiên liệu → áp/nhiệt/tải giảm; turbine coast; post‑purge |

## 11. Malfunction injection (OTS)
tube leak · mill trip · fan trip · BFP trip · sensor stuck · valve stuck · loss of vacuum · load rejection.
(Đề xuất 3 malfunction cho lát cắt W12: **mill trip · tube leak · loss of vacuum** — GĐ‑03.)

## 12. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑19 | τ/θ các vòng (§4) |
| GĐ‑20 | K_swell, hằng số bơm/quạt H0/a/P0/b (§3,§5) |
| GĐ‑21 | PID params khởi điểm (§9) — tuning ở pha code |
