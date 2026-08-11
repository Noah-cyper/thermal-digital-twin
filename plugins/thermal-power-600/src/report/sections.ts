// Plugin thermal-power-600 — mục báo cáo ca/ngày (doc 21). DỮ LIỆU/logic khai báo, chỉ import
// @idtp/sdk. ReportEngine (@idtp/engines) chạy. Đọc aggregate từ Historian qua IReportContext.
import type { IReportContext, IReportSection, ReportBlock } from '@idtp/sdk';

const KEY_TAGS: ReadonlyArray<{ tag: string; name: string }> = [
  { tag: 'GEN_MW_01', name: 'Công suất (MW)' },
  { tag: 'BLR_STEAM_FLOW_01', name: 'Hơi chính (t/h)' },
  { tag: 'BLR_MSTM_SH_PRESS_01', name: 'Áp hơi chính (MPa)' },
  { tag: 'BLR_MSTM_SH_TEMP_01', name: 'Nhiệt hơi SH (°C)' },
  { tag: 'BLR_FLUE_O2_01', name: 'O₂ khói (%)' },
  { tag: 'BLR_DRUM_LEVEL_01', name: 'Mức bao hơi (mm)' },
];

export const thermalReportSections: ReadonlyArray<IReportSection> = [
  {
    sectionId: 'operating-summary',
    title: { vi: 'Tóm tắt vận hành', en: 'Operating Summary' },
    async render(ctx: IReportContext): Promise<ReadonlyArray<ReportBlock>> {
      const rows: string[][] = [];
      for (const t of KEY_TAGS) {
        const [avg, mn, mx] = await Promise.all([ctx.read(t.tag, 'avg'), ctx.read(t.tag, 'min'), ctx.read(t.tag, 'max')]);
        rows.push([t.name, avg.toFixed(1), mn.toFixed(1), mx.toFixed(1)]);
      }
      return [{ kind: 'table', headers: ['Thông số', 'Trung bình', 'Min', 'Max'], rows }];
    },
  },
  {
    sectionId: 'narrative',
    title: { vi: 'Nhận xét', en: 'Narrative' },
    async render(ctx: IReportContext): Promise<ReadonlyArray<ReportBlock>> {
      const [mw, steam, o2] = await Promise.all([ctx.read('GEN_MW_01', 'avg'), ctx.read('BLR_STEAM_FLOW_01', 'avg'), ctx.read('BLR_FLUE_O2_01', 'avg')]);
      return [{ kind: 'text', text: `Công suất trung bình ${mw.toFixed(0)} MW, hơi chính ${steam.toFixed(0)} t/h, O₂ khói ${o2.toFixed(2)}% trong kỳ báo cáo.` }];
    },
  },
  {
    sectionId: 'trend',
    title: { vi: 'Xu hướng chính', en: 'Key Trends' },
    async render(ctx: IReportContext): Promise<ReadonlyArray<ReportBlock>> {
      return [{ kind: 'trend', tagIds: ['GEN_MW_01', 'BLR_STEAM_FLOW_01'], range: ctx.range }];
    },
  },
  {
    // Tóm tắt SỨC KHOẺ TÀI SẢN (AI cognitive) trong kỳ — đọc tag chỉ thị fleet AH_FLEET_* từ Historian
    // (READ-ONLY). Chẩn đoán/RUL/nguyên nhân gốc chi tiết xem panel 🤖 AI (doc 20 §Cognitive).
    sectionId: 'asset-health',
    title: { vi: 'Sức khoẻ tài sản (AI)', en: 'Asset Health (AI)' },
    async render(ctx: IReportContext): Promise<ReadonlyArray<ReportBlock>> {
      const [avg, avgMin, worst, anomMax, okMin] = await Promise.all([
        ctx.read('AH_FLEET_AVG_01', 'avg'),
        ctx.read('AH_FLEET_AVG_01', 'min'),
        ctx.read('AH_FLEET_WORST_01', 'min'),
        ctx.read('AH_FLEET_ANOMALIES_01', 'max'),
        ctx.read('AH_FLEET_HEALTHY_01', 'min'),
      ]);
      return [
        {
          kind: 'text',
          text: `Sức khoẻ fleet trung bình ${avg.toFixed(0)}/100 (thấp nhất kỳ ${avgMin.toFixed(0)}); tài sản kém nhất trong kỳ ${worst.toFixed(0)}/100; cao điểm ${anomMax.toFixed(0)} tín hiệu bất thường; tối thiểu ${okMin.toFixed(0)} tài sản lành mạnh. AI CHỈ ĐỌC — chẩn đoán/RUL xem panel 🤖 AI.`,
        },
        {
          kind: 'table',
          headers: ['Chỉ số sức khoẻ (AI)', 'Giá trị'],
          rows: [
            ['Điểm fleet trung bình (kỳ)', avg.toFixed(0) + ' /100'],
            ['Điểm fleet thấp nhất (kỳ)', avgMin.toFixed(0) + ' /100'],
            ['Tài sản kém nhất (kỳ)', worst.toFixed(0) + ' /100'],
            ['Cao điểm bất thường', anomMax.toFixed(0)],
            ['Tài sản lành mạnh tối thiểu', okMin.toFixed(0)],
          ],
        },
      ];
    },
  },
];
