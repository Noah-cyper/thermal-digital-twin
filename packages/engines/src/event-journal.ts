// @idtp/engines — Event Journal / SOE (Sequence of Events). Màn hình hệ thống "Event Log" (ISA-101
// S-class, doc 00 §màn hình hệ thống; audit doc 15/18). GENERIC: chỉ ghi lại SỰ KIỆN đã xảy ra trong
// hệ (alarm/trip/lệnh/chuỗi/bảo mật/hệ thống) — READ-ONLY với process, không ghi tag/setpoint. Danh mục
// sự kiện là tập cố định trung tính (không tên plugin) nên engine giữ tính generic. Thời gian do người
// gọi cấp (TimeService), không Date.now — nhất quán đồng hồ sim/deploy.

export type JournalCategory = 'alarm' | 'trip' | 'command' | 'sequence' | 'security' | 'system';
export type JournalSeverity = 'info' | 'warn' | 'critical';

export interface JournalEntry {
  readonly seq: number; // số thứ tự tăng đơn điệu (report-by-exception feed)
  readonly at: string; // ISO 8601 do người gọi định dạng (đồng hồ sim/thật)
  readonly category: JournalCategory;
  readonly severity: JournalSeverity;
  readonly message: string;
  readonly actor?: string; // user/operator cho lệnh & bảo mật; undefined nếu tự động
  readonly source?: string; // id nguồn (tag/asset/alarm/sequence/matrix) sinh sự kiện
}

export interface JournalQuery {
  category?: JournalCategory;
  severity?: JournalSeverity;
  sinceSeq?: number; // chỉ lấy entry có seq > sinceSeq (feed report-by-exception)
  limit?: number; // trần số dòng trả (mặc định 200)
}

export interface JournalSummary {
  readonly total: number;
  readonly byCategory: Record<JournalCategory, number>;
  readonly bySeverity: Record<JournalSeverity, number>;
  readonly notable: ReadonlyArray<JournalEntry>; // đuôi sự kiện đáng chú ý (trip / critical), mới nhất trước
}

const ALL_CATEGORIES: ReadonlyArray<JournalCategory> = ['alarm', 'trip', 'command', 'sequence', 'security', 'system'];
const ALL_SEVERITIES: ReadonlyArray<JournalSeverity> = ['info', 'warn', 'critical'];

/**
 * Nhật ký sự kiện dạng vòng (ring buffer) — GENERIC. Ghi lại sự kiện đã xảy ra; không tác động process.
 * `record` gán seq tăng dần; `query` trả mới-nhất-trước có lọc; `summary` tổng hợp theo danh mục/mức.
 */
export class EventJournal {
  private readonly buf: JournalEntry[] = [];
  private seqCounter = 0;

  constructor(private readonly cap = 5000) {}

  /** Ghi một sự kiện (seq tự gán). Vượt sức chứa → bỏ entry cũ nhất (ring). */
  record(e: Omit<JournalEntry, 'seq'>): JournalEntry {
    const entry: JournalEntry = { seq: ++this.seqCounter, at: e.at, category: e.category, severity: e.severity, message: e.message, actor: e.actor, source: e.source };
    this.buf.push(entry);
    if (this.buf.length > this.cap) this.buf.shift();
    return entry;
  }

  /** Truy vấn mới-nhất-trước, lọc theo category/severity/sinceSeq, trần limit. */
  query(opts: JournalQuery = {}): ReadonlyArray<JournalEntry> {
    const limit = opts.limit ?? 200;
    const out: JournalEntry[] = [];
    for (let i = this.buf.length - 1; i >= 0 && out.length < limit; i--) {
      const e = this.buf[i];
      if (e === undefined) continue;
      if (opts.sinceSeq !== undefined && e.seq <= opts.sinceSeq) break; // buf theo seq tăng dần → dừng sớm
      if (opts.category !== undefined && e.category !== opts.category) continue;
      if (opts.severity !== undefined && e.severity !== opts.severity) continue;
      out.push(e);
    }
    return out;
  }

  /** Tổng hợp toàn nhật ký: đếm theo danh mục/mức + đuôi sự kiện đáng chú ý (trip hoặc critical). */
  summary(notableLimit = 12): JournalSummary {
    const byCategory: Record<JournalCategory, number> = { alarm: 0, trip: 0, command: 0, sequence: 0, security: 0, system: 0 };
    const bySeverity: Record<JournalSeverity, number> = { info: 0, warn: 0, critical: 0 };
    for (const e of this.buf) {
      byCategory[e.category] += 1;
      bySeverity[e.severity] += 1;
    }
    const notable: JournalEntry[] = [];
    for (let i = this.buf.length - 1; i >= 0 && notable.length < notableLimit; i--) {
      const e = this.buf[i];
      if (e === undefined) continue;
      if (e.category === 'trip' || e.severity === 'critical') notable.push(e);
    }
    return { total: this.buf.length, byCategory, bySeverity, notable };
  }

  /** seq lớn nhất đã cấp — client dùng làm mốc sinceSeq cho lần feed kế. */
  get lastSeq(): number {
    return this.seqCounter;
  }

  static categories(): ReadonlyArray<JournalCategory> {
    return ALL_CATEGORIES;
  }
  static severities(): ReadonlyArray<JournalSeverity> {
    return ALL_SEVERITIES;
  }
}
