# 05‑16 — Navigation (L2, ISA‑101)

> Đặc tả theo khung 10 mục §8. Cây điều hướng **tách khỏi** cây thiết bị (Asset Model). Luật §7.

## 1. Mục đích & ranh giới trách nhiệm

Quản lý **cây điều hướng ISA‑101** (D1–D4 + S), ép **luật điều hướng** (§7), phân giải alarm→màn hình.
Plugin khai báo `nav/tree.yaml`, **kernel render**.

| KHÔNG thuộc engine này | Thuộc về |
|---|---|
| Cây thiết bị | Asset Model (05‑10, ISA‑95) |
| Render đồ hoạ | Graphics (05‑02) |
| Nội dung màn hình | Plugin (screen.json) |

## 2. Interface công bố

```typescript
export type ScreenLevel = 'D1' | 'D2' | 'D3' | 'D4' | 'S';
export interface NavNode { screenId: string; level: ScreenLevel; title: { vi: string; en: string }; parentId?: string; hotkey?: number; }

export interface INavigation {
  load(tree: unknown, pluginNamespace: string): void;
  breadcrumb(screenId: string): ReadonlyArray<NavNode>;
  resolveAlarm(alarmId: string): string;    // → screenId D3 chứa tag của alarm
  home(): string;                           // D1
  byHotkey(n: number): string | undefined;
  history(): { back(): string | undefined; forward(): string | undefined };
}
```

## 3. Mô hình dữ liệu nội bộ

| Cấu trúc | Vai trò |
|---|---|
| `nodes` | cây điều hướng (D1–D4 + S) |
| `hotkeys: Map<number, screenId>` | phím tắt số |
| `alarmIndex: Map<alarmId, D3 screenId>` | alarm → nhảy D3 |
| `stack` | back/forward như trình duyệt |

## 4. Luồng xử lý

```mermaid
sequenceDiagram
  participant U as Operator
  participant NAV as Navigation
  U->>NAV: click alarm trong ribbon
  NAV->>NAV: resolveAlarm(alarmId) → D3 chứa tag
  NAV->>U: nhảy thẳng tới D3 (≤ 1 thao tác)
  Note over NAV: về D1 ≤ 1 thao tác; D1→D3 ≤ 2; breadcrumb mọi nơi
```

## 5. Cấu hình (ví dụ — nav/tree.yaml)

```yaml
nav:
  - { screenId: D1-plant, level: D1, hotkey: 1, title: { vi: "Tổng quan nhà máy", en: "Plant Overview" } }
  - { screenId: D2-boiler, level: D2, parentId: D1-plant, hotkey: 2, title: { vi: "Lò hơi", en: "Boiler" } }
  - { screenId: D3-steam-drum, level: D3, parentId: D2-boiler, title: { vi: "Bao hơi", en: "Steam Drum" } }
```

## 6. Chỉ tiêu phi chức năng

| Chỉ tiêu | Mục tiêu |
|---|---|
| Về D1 | ≤ 1 thao tác |
| D1 → D3 | ≤ 2 thao tác |
| Screen call‑up | < 1 s |
| Breadcrumb | mọi màn hình |

## 7. Chế độ lỗi & phục hồi

| Sự cố | Hệ quả | Phục hồi |
|---|---|---|
| Màn hình thiếu | link gãy | fallback về D1 |
| Alarm không có D3 | không nhảy được | về màn hình Area gần nhất |

## 8. Cách plugin mở rộng

Plugin cung cấp `nav/tree.yaml`; kernel render. **Không** viết code điều hướng.

## 9. Kế hoạch kiểm thử

| Loại | Nội dung |
|---|---|
| Unit | breadcrumb; hotkey; `resolveAlarm` |
| Integration | luật ≤ 2 thao tác D1→D3; alarm→D3 |

## 10. Quyết định & phương án đã loại bỏ

| Quyết định | Chọn | Loại bỏ | Lý do |
|---|---|---|---|
| Cây | **Tách khỏi Asset Model** | Gộp với cây thiết bị | §17 cấm gộp (N4) |
| Khai báo | **nav/tree.yaml (plugin)** | Hardcode trong kernel | Kernel không biết plugin cụ thể |
| Alarm→màn hình | **Index dựng sẵn** | Dò thủ công | Nhảy D3 ≤ 1 thao tác |
