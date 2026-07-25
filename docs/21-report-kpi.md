# 21 — Report & KPI

> Tài liệu #21/00–25 (§14). Engine: doc 05‑17. Neo Design Basis §3.1.

## 1. Công thức KPI
| KPI | Công thức | Đơn vị | Design Basis |
|---|---|---|---|
| **Heat rate** | fuel_heat_input / net_power | kJ/kWh | ~9.200 |
| **Hiệu suất** | 3600 / heat_rate | % | ~39 |
| **Aux power** | aux_power / gross_power × 100 | % | ~7 |
| **Availability** | running_hours / period_hours × 100 | % | — |
| **Net/Gross** | net_MW / gross_MW | — | 558/600 |
| **Steam rate** | ṁ_steam / MW | t/(h·MW) | từ BMCR 2.008 t/h |

## 2. Danh mục báo cáo
| Báo cáo | Chu kỳ | Nội dung |
|---|---|---|
| Shift report | mỗi ca | MW, KPI, alarm summary, sự kiện |
| Daily report | ngày | tổng hợp KPI, availability, phát thải (CEMS) |
| Emission report | ngày/tháng | SO₂/NOx/bụi (CEMS) |
| Event/trip report | theo sự kiện | first‑out, C&E, trend quanh sự cố |

## 3. Xuất
PDF · Excel · CSV. Template cố định (v1); designer (v2). Nhận xét AI đánh dấu `authoredByAi` (§11).

## 4. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑29 | Danh mục KPI mở rộng (theo yêu cầu vận hành) — bổ sung khi triển khai |
