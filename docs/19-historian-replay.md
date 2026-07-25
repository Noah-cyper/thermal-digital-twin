# 19 — Historian & Replay

> Tài liệu #19/00–25 (§14). Engine: doc 05‑04. Nguồn: §12. DB: doc 15.

## 1. Lớp lưu trữ
| Lớp | Chu kỳ | Giữ | Nén |
|---|---|---|---|
| Raw fast | 1 s | 7 ngày | swinging‑door + deadband theo tag |
| Rollup 1 | 1 phút | 90 ngày | avg/min/max/stddev/count |
| Rollup 2 | 15 phút | 2 năm | avg/min/max |
| Rollup 3 | 1 giờ | 5 năm | avg/min/max |
| Rollup 4 | 1 ngày | 10 năm | avg + totalizer |

TimescaleDB hypertable + continuous aggregate + compression. Mọi giá trị có quality; substituted đánh dấu vĩnh viễn + audit.

## 2. Replay — 2 chế độ (không lẫn)
| | DATA REPLAY | RE‑SIMULATION (what‑if) |
|---|---|---|
| Nguồn | Historian | Snapshot + Sim |
| Can thiệp | Không | Có |
| Alarm | phát lại timestamp gốc | sinh mới |
| Ghi historian | Không | nhánh riêng (branch id) |
| Banner | **Tím** | **Cam** |
| Lệnh ra thiết bị | chặn cứng tầng API | chặn cứng tầng API |
| Phiên bản | v1 | v2 |

## 3. Yêu cầu
Snapshot toàn tag mỗi 5 phút · đồng hồ replay độc lập · tốc độ 0,25×–60× · seek < 2 s ·
đồng bộ màn hình + trend + alarm theo đồng hồ replay.

## 4. Giả định
Không mới (tham chiếu GĐ‑10 retention_class).
