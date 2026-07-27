# 20 — AI Advisor Spec

> Tài liệu #20/00–25 (§14). Engine: doc 05‑19. Nguồn: §11. **v1 = rule‑based; RAG/AI thật = v2** (CLAUDE.md).

## 1. Luật cấm tuyệt đối (§11.1)
1. AI **read‑only** — không ghi tag/đổi setpoint/ACK/đổi mode/start‑stop. Không ngoại lệ.
2. Không sinh số liệu process không có trong historian/tag registry.
3. Mọi câu trả lời kèm **nguồn**: tag id + khoảng thời gian + tên SOP/tài liệu.
4. "Không đủ dữ liệu để kết luận" là câu trả lời **hợp lệ**.
5. Toàn bộ prompt/response → `audit_trail`, giữ ≥ 1 năm.
6. Output nền màu riêng + nhãn **"AI — THAM KHẢO, KHÔNG PHẢI LỆNH VẬN HÀNH"**.

## 2. Phạm vi theo phiên bản
| Chức năng | Cách làm | Ver |
|---|---|---|
| Giải thích alarm | RAG trên C&E + SOP + trend 30' trước | v2 |
| Hướng dẫn SOP | trích nguyên văn + link | v2 |
| Phân tích trend | thống kê (slope, stddev, baseline cùng tải) | v2 |
| Predictive maint | luật + ngưỡng + running hour + độ dốc (KHÔNG hộp đen) | v2 |
| ML dự báo hỏng | ≥ 6 tháng dữ liệu thật + baseline | v3 |
| Sinh báo cáo | điền template; nhận xét đánh dấu `authoredByAi` | v2 |
| Chat operator | có, chặn ý định điều khiển bằng **intent filter** | v2 |
| Mô phỏng sự cố | scenario của Sim, **không** phải AI | v1 |

## 3. Triển khai
Provider cắm‑rút (Ollama/vLLM local — **air‑gap**); không khóa nhà cung cấp. Guardrail test: ép AI ghi tag → **bị từ chối** (doc 05‑19 §9).

## 4. Giả định
Không mới.
