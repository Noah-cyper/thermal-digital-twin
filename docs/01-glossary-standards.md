# 01 — Glossary & Standards (Thuật ngữ & Chuẩn áp dụng)

> Tài liệu #01/00–25. Chốt **§3 prompt cha** (định nghĩa dùng thống nhất toàn dự án) + **danh mục
> chuẩn áp dụng**. Mọi tài liệu sau phải dùng đúng thuật ngữ ở đây. Nhất quán màu/priority/quality
> với doc 00 & Phụ lục A. Ngôn ngữ: tiếng Việt, thuật ngữ giữ tiếng Anh.
>
> **Luật chống bịa (§15.4):** không trích *số điều khoản* tiêu chuẩn khi không chắc — mô tả **phạm
> vi/nguyên tắc**. Suy đoán → `[GIẢ ĐỊNH]` (→ doc 25).

**Mục lục:** A. Thuật ngữ chốt (A1 Digital Twin · A2 SCADA/DCS/OTS · A3 Engine/Service/Plugin ·
A4 Tag/Signal/Asset/Symbol · A5 Replay/Re‑simulation · A6 Process & Control · A7 Alarm & HMI) ·
B. Danh mục chuẩn (B1 áp dụng · B2 loại trừ · B3 quy ước trích dẫn) · C. Quyết định thuật ngữ.

---

## A. THUẬT NGỮ CHỐT

### A1. Digital Twin — 4 mức, **v1 = L1 + L2**

| Mức | Tên | Trả lời câu hỏi | Phiên bản |
|---|---|---|---|
| **L1** | Mô tả (Descriptive) | *Trạng thái hiện tại ra sao?* — mirror giá trị/trạng thái process | **v1** |
| **L2** | Chẩn đoán (Diagnostic) | *Tại sao xảy ra?* — rule‑based diagnostics, giải thích alarm/nguyên nhân | **v1** |
| L3 | Dự báo (Predictive) | *Điều gì sắp xảy ra?* — cần ≥ 6 tháng dữ liệu vận hành thực | v2/v3 |
| L4 | Kê đơn (Prescriptive) | *Nên làm gì?* — tối ưu định lượng | v3 |

**Virtual twin:** IDTP **chưa** ghép cặp tài sản vật lý → thực chất là **Operator Training Simulator
(OTS) + Virtual Commissioning platform**. Không gọi là "digital twin đầy đủ" trong tài liệu marketing.

### A2. SCADA vs DCS vs OTS vs HMI

| Tiêu chí | SCADA | DCS | OTS | HMI |
|---|---|---|---|---|
| Điều khiển real‑time cấp I/O | Giám sát + một phần | **Có, tất định** | Không (mô phỏng) | Không |
| Chứng nhận an toàn (SIL) | Thường không | **Có thể** | Không | Không |
| Sở hữu I/O phần cứng | Qua RTU/PLC | **Trực tiếp** | Không | Không |
| Mục đích | Giám sát diện rộng | Điều khiển quá trình | Đào tạo/kiểm chứng | Hiển thị/tương tác |
| **Vị trí IDTP** | ✔ HMI kiểu SCADA | ✘ không phải | ✔ engine mô phỏng | ✔ client trình bày |

### A3. Engine vs Service vs Plugin (load‑bearing kiến trúc)

| Khái niệm | Định nghĩa | Ví dụ | ĐƯỢC chứa | KHÔNG được chứa |
|---|---|---|---|---|
| **Engine** | Năng lực lõi tái sử dụng, độc lập ngành | Alarm Engine, Historian, Graphics Runtime | Logic kernel chung | Số liệu/tri thức của 1 nhà máy cụ thể |
| **Service** | Tiến trình triển khai (deployable) | `apps/api`, `apps/sim-engine` | Cấu hình vận hành 1 engine/nhiều engine | — |
| **Plugin** | Gói **nội dung ngành, dữ liệu khai báo** | `thermal-power-600`, `water-treatment-demo` | tag/alarm/screen JSON, `ISimModel` | **Logic kernel**; component React màn hình process; ghi thẳng DB |

> Kernel **không** biết tên plugin cụ thể; plugin **chỉ** import từ `@idtp/sdk`. (Chi tiết → doc 03.)

### A4. Tag vs Signal vs Asset vs Symbol — 4 khái niệm, ID riêng

| Khái niệm | Là gì | Định danh | Ghi chú |
|---|---|---|---|
| **Signal** | Đại lượng vật lý thô tại nguồn (sim/OPC UA/Modbus) | metric name nguồn | Trước khi chuẩn hoá |
| **Tag** | Bản ghi chuẩn hoá (EU, dải, deadband, scan class, quality…) | **tag id nội bộ (UUID/số)** | Mọi hệ tham chiếu bằng tag id; KKS/UNS là thuộc tính |
| **Asset** | Thiết bị/đơn vị trong cây ISA‑95 | asset id | Tag ↔ asset là N‑1 |
| **Symbol** | Ký hiệu đồ hoạ (Pump, Valve…) trên màn hình | symbol id | Symbol ↔ tag là N‑N qua binding |

**Ví dụ ánh xạ 3 chiều** (khớp Phụ lục A §10.1 — main steam SH pressure, KKS đã verified):

| Chiều | Giá trị |
|---|---|
| KKS | `10LAB10CP001` |
| Fallback name | `BLR_MSTM_SH_PRESS_01` |
| UNS | `hoantran/haiphong/unit1/boiler/main-steam/pt-001/pv` |
| Sparkplug metric | `BOILER/MSTM_SH_PRESS_01` |
| tag id nội bộ | UUID/số (khoá tham chiếu duy nhất) |

> Cấu trúc UNS: `{enterprise}/{site}/{area}/{cell}/{unit}/{equipment}/{signal}`. Bảng đầy đủ → doc 04/07.

### A5. Replay vs Re‑simulation — **2 chế độ, 2 màu banner, không được lẫn**

| | **DATA REPLAY** | **RE‑SIMULATION (what‑if)** |
|---|---|---|
| Nguồn | Historian | Snapshot + Simulation Engine |
| Cho can thiệp (đổi SP, gây sự cố) | **Không** | Có |
| Alarm | Phát lại theo timestamp gốc | Sinh mới |
| Ghi historian | Không | Có — vào **nhánh riêng** (branch id) |
| **Banner** | **Tím**, toàn chiều ngang | **Cam**, toàn chiều ngang |
| Lệnh ra thiết bị | **Chặn cứng ở tầng API** | Chặn cứng ở tầng API |
| Phiên bản | v1 (trong lát cắt) | v2 |

### A6. Thuật ngữ process & control (compact — chi tiết ở doc 06/09/10)

| Thuật ngữ | Nghĩa |
|---|---|
| **PV / SP / OP (MV)** | Process Variable / Setpoint / Output (Manipulated Variable) |
| **MAN / AUTO / CASCADE** | Chế độ loop: tay / tự động / phụ thuộc SP loop khác |
| **Permissive** | Điều kiện AND/OR **cho phép khởi động** (chặn *start*) |
| **Interlock** | Điều kiện **chặn/ngăn** khi đang chạy (bảo vệ) |
| **Trip** | Lệnh **dừng khẩn** thiết bị/hệ |
| **MFT** | Master Fuel Trip — cắt toàn bộ nhiên liệu vào lò |
| **Runback (RB)** | Giảm tải nhanh có kiểm soát khi mất thiết bị phụ (vd mill/fan) |
| **BMCR** | Boiler Maximum Continuous Rating (Phụ lục A: 2.008 t/h) |
| **Swell / Shrink** | Đảo pha mức bao hơi ngắn hạn khi tải đổi nhanh (dấu hiệu sim thật) |
| **Bumpless transfer** | Chuyển mode không gây nhảy OP |
| **Anti‑windup** | Chống tích phân bão hoà khi OP chạm giới hạn |

### A7. Thuật ngữ alarm & HMI (compact — chi tiết ở doc 08/11)

| Thuật ngữ | Nghĩa | Giá trị chốt |
|---|---|---|
| **Priority P1–P4** | Mức ưu tiên + thời gian đáp ứng | P1 Critical 30 s · P2 High 10' · P3 Medium 30' · P4 Low/Diag ∞ |
| **Deadband** | Dải chống chattering quanh setpoint | 2–5 % dải đo |
| **On/Off‑delay** | Trễ vào/ra alarm | on 2–5 s · off 5–10 s |
| **Quality code** | Chất lượng giá trị | Good · Uncertain · Bad · **Substituted** (đánh dấu vĩnh viễn + audit) |
| **Shelving** | Tạm ẩn alarm **có thời hạn** | max 8 h, tự bung, ghi audit |
| **Suppression** | Ẩn theo trạng thái thiết bị (vd "low flow" khi bơm dừng) | theo logic |
| **Out‑of‑service** | Ngưng alarm theo bảo trì | ghi audit |
| **RBE** | Report‑by‑exception (chỉ gửi khi vượt deadband) | — |
| **Scan class** | Chu kỳ quét | 250 ms / 500 ms / 1 s / 5 s |
| **D1–D4 / S** | Cấp màn hình ISA‑101 | Plant/Area/Equipment/Diagnostic + System |
| **Faceplate** | Popup thiết bị 4 tab | Overview · Trend · Alarm · Detail |

---

## B. DANH MỤC CHUẨN ÁP DỤNG

### B1. Chuẩn áp dụng (mô tả **phạm vi/nguyên tắc**, không trích số điều khoản)

| Chuẩn | Tương đương IEC/ISO | Phạm vi | IDTP dùng cho | Phiên bản |
|---|---|---|---|---|
| **ISA‑95** | IEC 62264 | Tích hợp enterprise↔control, cây thiết bị (enterprise→site→area→work center→work unit) | Asset Model, cây ISA‑95 | v1 |
| **ISA‑88** | IEC 61512 | Mô hình vật lý/thủ tục (equipment module, control module) | Thuật ngữ phân cấp thiết bị, SFC | v1 |
| **ISA‑101** | — | Thiết kế HMI, display hierarchy, High Performance HMI | Cây màn hình D1–D4, palette, faceplate | v1 |
| **ISA‑18.2** | IEC 62682 | Vòng đời & state machine quản lý alarm | Alarm Engine | v1 |
| **EEMUA 191** | — | Hướng dẫn hệ alarm, chỉ tiêu hiệu năng (alarm rate) | Alarm KPI/Diagnostic | v1 |
| **ISA‑5.1** | — | Ký hiệu & định danh instrument (P&ID) | Symbol library | v1 |
| **IEC 61131‑3** | IEC 61131‑3 | Ngôn ngữ lập trình điều khiển (LD/FBD/ST/IL/SFC) | Control Engine (SFC "theo tinh thần") | v1 |
| **IEC 61850** | IEC 61850 | Truyền thông tự động hoá trạm biến áp | Switchyard 500 kV | v3 |
| **IEC 62443** | IEC 62443 (‑2‑1/‑3‑2/‑3‑3/‑4‑x) | An ninh IACS: zone/conduit, security level | OT Security, RBAC, audit | v1 (nguyên tắc) |
| **NFPA 85** | — | Boiler & combustion hazards, BMS/purge | Purge/light‑off sequence | v1 |
| **VGB‑B 106 / KKS** | — | Định danh thiết bị nhà máy điện | Chuẩn đặt tên tag (KKS) | v1 |
| **OPC UA** | IEC 62541 | Interoperability công nghiệp | Protocol Gateway | v3 |
| **MQTT Sparkplug B** | (Eclipse Tahu) | Payload/state cho SCADA trên MQTT | Data bus | v1 |
| **Modbus** | — | Giao thức serial/TCP | Gateway | v3 |
| **Profinet / EtherNet‑IP** | IEC 61158/61784 · ODVA | Industrial Ethernet | Gateway (nếu cần) | v3 |
| **BACnet** | ISO 16484‑5 | Tự động hoá toà nhà | HVAC (BoP) | v3 |
| **RFC 7807** | — | Problem Details cho HTTP API | Chuẩn lỗi REST | v1 |
| **OpenAPI 3.1** | — | Đặc tả API | REST contract | v1 |

### B2. Chuẩn **loại trừ** — nói rõ không tuyên bố năng lực

| Chuẩn | Phạm vi | Vì sao loại trừ |
|---|---|---|
| **IEC 61508 / 61511** | Functional safety / SIL | IDTP **không** phải hệ an toàn; không xin chứng nhận (doc 00 §5) |
| **IEC 61513** | I&C nhà máy điện **hạt nhân** (class 1E) | Loại trừ hẳn (§1 prompt cha) — không sinh nội dung |

### B3. Quy ước trích dẫn chuẩn (chống bịa)

| Quy tắc | Cách làm |
|---|---|
| Số điều khoản | **Không** trích nếu không chắc → mô tả nguyên tắc |
| "Theo Siemens PCS7" | Chỉ khi chắc; nếu suy đoán → "theo thông lệ DCS phổ biến" |
| Số kỹ thuật ngoài Design Basis | Gắn `[GIẢ ĐỊNH]` → doc 25 |
| Tương đương IEC/ISO ở B1 | Là mã định danh chuẩn (không phải điều khoản) — đã kiểm; nghi ngờ → xác minh trước khi dùng trong doc sau |

---

## C. QUYẾT ĐỊNH THUẬT NGỮ & PHƯƠNG ÁN ĐÃ LOẠI BỎ

| Quyết định | Chọn | Loại bỏ | Lý do |
|---|---|---|---|
| Gọi tên hệ | **"virtual twin / OTS"** | "digital twin đầy đủ" | Chưa ghép tài sản vật lý → tránh over‑claim |
| Tách Tag ≠ Signal | **Có, ID riêng** | Gộp làm một | Tách nguồn thô khỏi bản ghi chuẩn hoá; đổi nguồn không đổi tag id |
| Khoá tham chiếu | **tag id nội bộ (UUID/số)** | Tham chiếu bằng KKS/UNS trực tiếp | KKS/UNS có thể đổi; id nội bộ bất biến |
| Chuẩn đặt tên | **KKS (VGB‑B 106) + fallback name** | Chỉ KKS | KKS khó đọc trong code → cần fallback `AREA_SYS_EQUIP_MEAS_NN` |

---

## Giả định

| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑04 | Một số mã KKS chi tiết (ngoài ví dụ đã verified `10LAB10CP001`) sẽ được đánh dấu `[GIẢ ĐỊNH]` cho tới khi đối chiếu VGB‑B 106 ở doc 07 |

---

```
TRẠNG THÁI: Tài liệu 01 — Glossary & Standards (01-glossary-standards.md).
ĐÃ XONG: A1 Digital Twin 4 mức (v1=L1+L2, virtual twin=OTS+VC); A2 SCADA/DCS/OTS/HMI; A3
        Engine/Service/Plugin (được/không được chứa); A4 Tag/Signal/Asset/Symbol + ví dụ ánh xạ
        3 chiều đã verified; A5 Replay vs Re‑simulation (banner tím/cam); A6 process&control, A7
        alarm&HMI compact; B1 danh mục 18 chuẩn áp dụng + tương đương IEC/ISO; B2 chuẩn loại trừ
        (SIL, hạt nhân); B3 quy ước chống bịa; C quyết định thuật ngữ + phương án loại bỏ.
GIẢ ĐỊNH MỚI: GĐ‑04 (mã KKS chi tiết chờ đối chiếu ở doc 07) → doc 25.
XUNG ĐỘT / RỦI RO: không phát hiện xung đột số liệu; nhắc rủi ro trích số điều khoản → đã né bằng
        mô tả nguyên tắc.
CẦN QUYẾT ĐỊNH TỪ ANH: [PHÊ DUYỆT TÀI LIỆU 01?] — nếu OK, sang doc 02 (02-platform-architecture.md).
BƯỚC TIẾP THEO: sinh doc 02 (C4 L1–L3 + bảng ánh xạ 20 engine §4), rồi tóm tắt ≤ 15 dòng → chờ duyệt.
```
