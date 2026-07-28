// L2 — Report Engine (doc 05-17 / doc 21). Ráp báo cáo ca/ngày từ các IReportSection KHAI BÁO của
// plugin (§6.4 SDK): mỗi section render → khối table/text/trend qua IReportContext (đọc aggregate từ
// Historian theo range đã gắn). GENERIC: engine không biết nội dung; plugin cấp section. Report v1 =
// tổng hợp số liệu; designer kéo-thả & AI narrative = v2.
import type { IReportContext, IReportSection, Iso8601, ReportBlock } from '@idtp/sdk';

export interface ReportSectionResult {
  readonly sectionId: string;
  readonly title: { vi: string; en: string };
  readonly blocks: ReadonlyArray<ReportBlock>;
}
export interface Report {
  readonly title: { vi: string; en: string };
  readonly from: Iso8601;
  readonly to: Iso8601;
  readonly sections: ReadonlyArray<ReportSectionResult>;
}

export class ReportEngine {
  constructor(private readonly sections: ReadonlyArray<IReportSection>) {}

  /** Chạy mọi section theo thứ tự → gom thành Report. */
  async generate(ctx: IReportContext, title: { vi: string; en: string }): Promise<Report> {
    const out: ReportSectionResult[] = [];
    for (const s of this.sections) {
      out.push({ sectionId: s.sectionId, title: s.title, blocks: [...(await s.render(ctx))] });
    }
    return { title, from: ctx.range.from, to: ctx.range.to, sections: out };
  }
}
