// L2 — AI Advisor v1 RULE-BASED (doc 05-19 / doc 20). READ-ONLY TUYỆT ĐỐI: chỉ ĐỌC alarm/tag/tri
// thức, KHÔNG ghi tag, KHÔNG đổi setpoint, KHÔNG ACK. Giải thích một alarm = hậu quả + nguyên nhân
// (theo điều kiện) + khắc phục + LEO THANG (nếu khớp cause của ma trận C&E) + TRÍCH DẪN nguồn (SOP/
// narrative + tag + thời gian). Chống bịa: chỉ trích cái có thật; RAG/LLM thật đẩy sang v2.
import type { AlarmDef, CauseEffectMatrix, IKnowledgeDoc, Iso8601, Priority } from '@idtp/sdk';

export interface Citation {
  readonly kind: 'sop' | 'cause-effect' | 'narrative' | 'tag' | 'alarm';
  readonly ref: string; // docId / tagId / alarmId
  readonly title?: string;
  readonly when?: Iso8601;
}
export interface Advice {
  readonly alarmId: string;
  readonly priority: Priority;
  readonly summary: string;
  readonly likelyCause: string;
  readonly recommended: string;
  readonly escalation: string | null;
  readonly citations: ReadonlyArray<Citation>;
}

const COND_VI: Record<string, string> = {
  HH: 'rất cao (HH)', H: 'cao (H)', L: 'thấp (L)', LL: 'rất thấp (LL)',
  DEV: 'lệch (DEV)', ROC: 'biến thiên nhanh (ROC)', DISCRETE: 'kích hoạt',
};

export interface AdvisorDeps {
  alarms: ReadonlyArray<AlarmDef>;
  matrices?: ReadonlyArray<CauseEffectMatrix>;
  knowledge?: ReadonlyArray<IKnowledgeDoc>;
}
export interface AdviceContext {
  value?: number; // giá trị tag hiện tại (chỉ đọc)
  nowIso?: Iso8601;
}

export class AiAdvisor {
  private readonly alarmById: Map<string, AlarmDef>;
  constructor(private readonly deps: AdvisorDeps) {
    this.alarmById = new Map(deps.alarms.map((a) => [a.alarmId, a] as const));
  }

  /** Giải thích một alarm (read-only). undefined nếu alarm không tồn tại. */
  explainAlarm(alarmId: string, ctx: AdviceContext = {}): Advice | undefined {
    const a = this.alarmById.get(alarmId);
    if (!a) return undefined;

    const cond = COND_VI[a.condition] ?? a.condition;
    const valTxt = ctx.value !== undefined ? ` (đang ${ctx.value})` : '';
    const likelyCause = `Tín hiệu ${a.tagId} ${cond} so với ngưỡng ${a.setpoint}${valTxt}.`;
    const recommended = a.corrective?.vi ?? 'Xử lý theo quy trình vận hành (SOP) liên quan.';

    // Leo thang: nếu tag của alarm là NGUYÊN NHÂN trong ma trận C&E → cảnh báo hệ quả trip.
    let escalation: string | null = null;
    const citations: Citation[] = [{ kind: 'alarm', ref: a.alarmId, title: a.consequence.vi, ...(ctx.nowIso ? { when: ctx.nowIso } : {}) }];
    citations.push({ kind: 'tag', ref: a.tagId, ...(ctx.nowIso ? { when: ctx.nowIso } : {}) });

    for (const mx of this.deps.matrices ?? []) {
      const cause = mx.causes.find((c) => c.tag === a.tagId);
      if (!cause) continue;
      const effects = mx.cells.filter((cell) => cell.cause === cause.id).map((cell) => mx.effects.find((e) => e.id === cell.effect)?.title.vi ?? cell.effect);
      if (effects.length > 0) {
        escalation = `Nếu tiến triển tới ngưỡng bảo vệ, có thể kích ${mx.title.vi}: ${[...new Set(effects)].join(' · ')}.`;
        citations.push({ kind: 'cause-effect', ref: mx.matrixId, title: mx.title.vi });
      }
      break;
    }

    // Trích dẫn tri thức: doc có tagRefs chứa tag của alarm (SOP/narrative/cause-effect).
    for (const doc of this.deps.knowledge ?? []) {
      if (doc.tagRefs.includes(a.tagId)) citations.push({ kind: doc.kind, ref: doc.docId, title: doc.title.vi });
    }

    return { alarmId: a.alarmId, priority: a.priority, summary: a.consequence.vi, likelyCause, recommended, escalation, citations };
  }
}
