# CLAUDE.md — Industrial Digital Twin Platform (IDTP)

> **Luôn đọc `docs/00-master-prompt.md` và `docs/annex-A-thermal-design-basis.md` trước mỗi phiên làm việc.**

## Dự án
Nền tảng Digital Twin công nghiệp (IDTP): **kernel + plugin** — "mọi nhà máy chỉ là một plugin".
Plugin #1 = `thermal-power-600` (nhiệt điện than 600 MW subcritical, drum-type, reheat).

| File | Vai trò |
|---|---|
| `docs/00-master-prompt.md` | **Prompt cha (governing)** — kiến trúc platform, plugin contract, 26 tài liệu 00–25 |
| `docs/annex-A-thermal-design-basis.md` | **Phụ lục A** — design basis 600 MW + mô hình simulation, là ruột của plugin #1 (§10 prompt cha tham chiếu "lấy nguyên, không đổi số") |

## Chốt xung đột số liệu (file cha `00` thắng khi 2 file lệch nhau)
| Hạng mục | Chuẩn đã chốt |
|---|---|
| Tag định nghĩa toàn hệ | 200.000 (riêng plugin thermal = 15.000) |
| Ghi historian | ≥ 50.000 điểm/s |
| RBAC | 6 vai: Viewer · Operator · Shift Supervisor · Engineer · Maintenance · Admin |
| Bộ tài liệu | docs 00–25 (nội dung Phụ lục A ánh xạ vào doc 06/07/08/09/10) |
| AI | v1 = rule-based diagnostics; RAG/AI thật đẩy sang v2 |
| Digital Twin | v1 = L1 (mô tả) + L2 (chẩn đoán) → thực chất là OTS + Virtual Commissioning |

## Luật cứng (vi phạm = hỏng)
- KHÔNG viết code tới khi tài liệu 00–24 được duyệt (ngoại lệ: JSON/YAML schema, chữ ký interface, migration mẫu).
- KHÔNG `Math.random()` làm nguồn dữ liệu process.
- KHÔNG stub / TODO / "phần còn lại tương tự" / code rút gọn.
- KHÔNG hardcode màn hình process trong React — màn hình là **JSON khai báo**, kernel render.
- KHÔNG để plugin chứa logic kernel, hoặc kernel biết tên plugin cụ thể.
- KHÔNG gộp cây thiết bị (ISA-95) với cây điều hướng (ISA-101) làm một.
- Mọi số ngoài Design Basis → gắn `[GIẢ ĐỊNH]` + ghi vào tài liệu 25.
- AI **read-only tuyệt đối**: không ghi tag, không đổi setpoint, không ACK alarm.
- Alarm luôn có deadband + delay; lệnh ghi luôn có audit trail.

## Quy trình
- Phase gate: mỗi tài liệu xong → tóm tắt ≤ 15 dòng → hỏi `[PHÊ DUYỆT TÀI LIỆU NN?]` → **chờ**, không tự sang tài liệu kế.
- Trước khi viết tài liệu mới: đọc lại registry đã chốt (04 asset/UNS, 07 tag, 08 alarm, 11 style guide) để giữ nhất quán.
- Xung đột với chuẩn ISA/IEC/EEMUA: nói thẳng, nêu phương án chuẩn, rồi triển khai lựa chọn của người dùng qua config/theme (không hardcode).

## Quy ước
- Ngôn ngữ tài liệu: **tiếng Việt**; thuật ngữ kỹ thuật giữ **tiếng Anh**. Code/comment/identifier: **tiếng Anh**.
- Kết mỗi phản hồi dài bằng khối: `TRẠNG THÁI / ĐÃ XONG / GIẢ ĐỊNH MỚI / XUNG ĐỘT–RỦI RO / CẦN QUYẾT ĐỊNH / BƯỚC TIẾP THEO`.
