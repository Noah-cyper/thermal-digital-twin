// Plugin thermal-power-600 — cây điều hướng ISA-101 khai báo (doc 05-16 / doc 13). Chỉ import type
// từ @idtp/sdk. TÁCH khỏi cây thiết bị. D1 → D3 (≤ 2 thao tác); phím tắt số; kernel render.
import type { NavNode } from '@idtp/sdk';

export const thermalNav: ReadonlyArray<NavNode> = [
  { screenId: 'D1-plant-overview', level: 'D1', hotkey: 1, title: { vi: 'Tổng quan nhà máy', en: 'Plant Overview' } },
  { screenId: 'D3-steam-drum', level: 'D3', parentId: 'D1-plant-overview', hotkey: 2, title: { vi: 'Bao hơi & cấp nước', en: 'Steam Drum & Feedwater' } },
  { screenId: 'D3-boiler-combustion', level: 'D3', parentId: 'D1-plant-overview', hotkey: 3, title: { vi: 'Đốt & gió', en: 'Combustion & Air' } },
];
