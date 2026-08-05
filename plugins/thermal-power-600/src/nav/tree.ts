// Plugin thermal-power-600 — cây điều hướng ISA-101 khai báo (doc 05-16 / doc 13). Chỉ import type
// từ @idtp/sdk. TÁCH khỏi cây thiết bị. D1 → D3 (≤ 2 thao tác); phím tắt số; kernel render.
import type { NavNode } from '@idtp/sdk';

export const thermalNav: ReadonlyArray<NavNode> = [
  { screenId: 'D1-plant-mimic', level: 'D1', hotkey: 1, title: { vi: 'Sơ đồ nhà máy (live)', en: 'Plant Mimic (live)' } },
  { screenId: 'D1-plant-overview', level: 'D1', hotkey: 5, title: { vi: 'Tổng quan nhà máy', en: 'Plant Overview' } },
  { screenId: 'D1-electrical-sld', level: 'D1', hotkey: 6, title: { vi: 'Sơ đồ một sợi điện', en: 'Electrical SLD' } },
  { screenId: 'D3-steam-drum', level: 'D3', parentId: 'D1-plant-overview', hotkey: 2, title: { vi: 'Bao hơi & cấp nước', en: 'Steam Drum & Feedwater' } },
  { screenId: 'D3-boiler-combustion', level: 'D3', parentId: 'D1-plant-overview', hotkey: 3, title: { vi: 'Đốt & gió', en: 'Combustion & Air' } },
  { screenId: 'D3-turbine-generator', level: 'D3', parentId: 'D1-plant-overview', hotkey: 4, title: { vi: 'Turbine & Máy phát', en: 'Turbine & Generator' } },
  // Balance of Plant §10 (v1.40): các hệ phụ trợ có màn hình riêng, đưa vào cây điều hướng để truy cập trực tiếp.
  { screenId: 'D3-compressed-air', level: 'D3', parentId: 'D1-plant-overview', hotkey: 7, title: { vi: 'Khí nén & khí điều khiển', en: 'Compressed & Instrument Air' } },
  { screenId: 'D3-fuel-oil', level: 'D3', parentId: 'D1-plant-overview', hotkey: 8, title: { vi: 'Dầu đốt khởi động', en: 'Startup Fuel Oil' } },
  { screenId: 'D3-ash-handling', level: 'D3', parentId: 'D1-plant-overview', hotkey: 9, title: { vi: 'Thải tro (đáy + bay)', en: 'Ash Handling' } },
  { screenId: 'D3-soot-blower', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Thổi bụi bề mặt truyền nhiệt', en: 'Soot Blowing' } },
  { screenId: 'D3-water-treatment', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Xử lý nước khử khoáng (DM)', en: 'DM Water Treatment' } },
  { screenId: 'D3-emergency-power', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Nguồn điện khẩn cấp (Diesel/UPS)', en: 'Emergency Power' } },
  { screenId: 'D3-switchyard', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Trạm phân phối 500 kV', en: '500 kV Switchyard' } },
  { screenId: 'D3-hvac', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Điều hoà & thông gió (HVAC)', en: 'HVAC' } },
  { screenId: 'D3-fire-fighting', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Hệ chữa cháy', en: 'Fire Fighting' } },
  { screenId: 'D3-chemical-dosing', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Hoá chất điều hoà chu trình', en: 'Cycle Chemical Dosing' } },
  { screenId: 'D3-avr-excitation', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'AVR & hệ kích từ', en: 'AVR & Excitation' } },
  { screenId: 'D3-fwh-drains', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Drain cascade bình gia nhiệt', en: 'FWH Drain Cascade' } },
  { screenId: 'D3-ansi-protection', level: 'D3', parentId: 'D1-plant-overview', title: { vi: 'Bảo vệ máy phát (ANSI)', en: 'Generator Protection (ANSI)' } },
  // Hiệu chỉnh hiệu năng (v1.42): lượng hoá độ lệch KPI vs Design Basis.
  { screenId: 'D2-calibration', level: 'D2', parentId: 'D1-plant-overview', title: { vi: 'Hiệu chỉnh hiệu năng', en: 'Performance Calibration' } },
];
