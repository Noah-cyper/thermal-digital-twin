# 11 — HMI Style Guide (ISA‑101 / High Performance HMI)

> Tài liệu #11/00–25 (§14). Nguồn: Phụ lục A §9. **Registry màu chốt** — doc 12/14 phải khớp token.
> Graphics Runtime dùng token CSS (doc 05‑02), không hardcode hex trong plugin.

## 1. Nguyên tắc số 1
**Màu là tài nguyên hiếm — chỉ dùng báo bất thường.** Trạng thái bình thường = xám. Nếu yêu cầu
"Running = green" → làm **2 theme** (`hp-hmi` mặc định · `classic-color`) qua CSS variables, không hardcode.

## 2. Palette lõi (token → HEX)
| Vai trò | Token | HEX |
|---|---|---|
| Canvas nền | `--bg-canvas` | `#12161B` |
| Panel | `--bg-panel` | `#1E242B` |
| Đường lưới / viền | `--border` | `#2E3742` |
| Nét thiết bị tĩnh | `--equip-line` | `#8A939C` |
| Text chính / phụ | `--text` / `--text-dim` | `#E6EAEE` / `#9AA5B1` |
| Giá trị process | `--pv` | `#FFFFFF` on `#0F1419` |
| P1 Critical | `--alarm-1` | `#E5484D` |
| P2 High | `--alarm-2` | `#F5A524` |
| P3 Medium | `--alarm-3` | `#F5D90A` |
| P4 Low / Diag | `--alarm-4` | `#4C9AFF` |
| Bad quality / mất tín hiệu | `--bad-quality` | `#B14CFF` + gạch chéo |
| Manual mode | `--mode-man` | `#4C9AFF` |
| Chạy (theme classic) | `--run` | `#2FA84F` |
| Dừng | `--stop` | `#6B7280` |

## 3. Màu môi chất (đường ống)
| Môi chất | HEX | | Môi chất | HEX |
|---|---|---|---|---|
| Hơi chính | `#D93A3A` | | Nước tuần hoàn | `#1FA5D6` |
| Tái nhiệt | `#E8791E` | | Gió cấp 1/2 | `#93B8D8` |
| Hơi phụ | `#C084FC` | | Khói | `#8B7355` |
| Nước cấp | `#2E6FD9` | | Than | `#4A4A4A` |
| Nước ngưng | `#29A38A` | | Dầu FO | `#B8860B` |
| Khí nén | `#7B8794` | | H₂ | `#E056A0` |

## 4. Hai theme (CSS variables)
| | `hp-hmi` (mặc định) | `classic-color` |
|---|---|---|
| Trạng thái bình thường | xám (`--equip-line`) | Running = `--run` xanh lá |
| Màu dành cho | **chỉ bất thường/alarm** | trạng thái chạy/dừng + alarm |
| Cách đổi | ghi đè token CSS ở `:root[data-theme=...]` | như trên |
> Khác biệt phải ghi rõ trong doc; **không** hardcode — đổi theme = đổi biến.

## 5. Typography
- Font `tabular-nums` cho mọi số (căn cột). Mọi giá trị số **có đơn vị EU**.
- Không icon trang trí. Không emoji.
- Kích thước ưu tiên mật độ thông tin, không "thoáng" kiểu web.

## 6. Layout chuẩn (mọi màn hình — Phụ lục A §9.3)
```
┌ BANNER 56px: Unit · MW · Freq · Tải · Alarm P1/P2/P3 · User · giờ · link ┐
├ NAV 88px ┬ PROCESS AREA (SVG, KHÔNG cuộn) ─────────────────────────────┤
│          │                                                              │
├ ALARM RIBBON 96px: 3 alarm mới nhất chưa ACK, luôn hiện ────────────────┤
└────────────────────────────────────────────────────────────────────────┘
```

## 7. Luật vàng (cấm — §9.4/§17)
| Cấm | Cho phép |
|---|---|
| Gradient · đổ bóng · bo góc > 2px · 3D | nét phẳng, viền mảnh |
| Emoji · icon trang trí · hoạt hình trang trí | animation process (quay/chảy/đổi màu theo dữ liệu) |
| Nhấp nháy tuỳ tiện | nhấp nháy **1 Hz chỉ cho alarm chưa ACK** |
| Cuộn ở vùng process | vùng process cố định |
| Số không đơn vị | EU + tabular‑nums |
| Card bo tròn kiểu dashboard | panel CCR mật độ cao |

## 8. Faceplate (popup thiết bị) — 4 tab cố định
Overview (PV/SP/OP, mode) · Trend (1h/8h/24h) · Alarm (limit) · Detail (KKS, EU, interlock, giờ chạy).
Bắt buộc hiện **lý do bị chặn** (doc 05‑15). Chi tiết symbol → doc 14; màn hình → doc 12.
