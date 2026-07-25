# 14 — Component Library (packages/ui)

> Tài liệu #14/00–25 (§14). Render bởi Graphics Runtime (doc 05‑02); màu theo token doc 11.
> **≥ 35 symbol**, mỗi symbol đủ trạng thái + Storybook. Props chuẩn.

## 1. Props chuẩn (mọi component)
`{ tag, value, quality, state, alarmState, mode, onClick }`. Tự đăng ký subscribe tag. Không biết giao thức.

## 2. Trạng thái bắt buộc (mỗi symbol)
`normal · running · fault · bad-quality (gạch chéo tím) · shelved` + `mode: MAN/AUTO/CASCADE` (nếu có loop).

## 3. Danh mục symbol (≥ 35)
| Nhóm | Symbol |
|---|---|
| Thiết bị quay | `Motor` `Pump` `Fan` `Mill` `Conveyor` |
| Van/điều tiết | `Valve` (on/off · control · damper) |
| Bình/trao đổi | `Tank` `Drum` `HeatExchanger` `Boiler` `CoolingTower` `Deaerator` |
| Nhiệt/cơ | `Turbine` `Generator` |
| Điện | `Transformer` `Breaker` `Disconnector` `Busbar` |
| Khói/bụi | `ESP` `Stack` |
| Ống | `Pipe` (màu theo môi chất) |
| Hiển thị | `NumericDisplay` `Bargraph` `Gauge` `TrendChart` `ModeIndicator` `InterlockBadge` |
| Alarm/faceplate | `AlarmBanner` `AlarmTable` `Faceplate` |
| Đặc thù nhiệt điện | `Burner` `SootBlower` `AirHeater` `Economizer` `Pulverizer` |

→ **≥ 35 ✓** (~40 symbol). Symbol đặc thù plugin qua `ICustomSymbol` (doc 03).

## 4. Yêu cầu chất lượng
- Storybook story cho **mỗi** symbol × đủ trạng thái.
- SVG (≤ 2.000 phần tử) / chuyển Canvas khi vượt (doc 05‑02).
- Không gradient/đổ bóng/emoji (doc 11).

## 5. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑24 | Danh mục ~40 symbol — bổ sung khi dựng screen.json thực (doc 12) |
