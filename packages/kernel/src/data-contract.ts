// Kernel L1 — Data Contract + Persistence (doc 05-11). Schema Zod ở biên; đường ghi duy nhất
// (plugin không ghi thẳng DB). Adapter cắm được (memory cho skeleton; Timescale/PG ở pha sau).
import type { ZodType } from 'zod';

export interface PersistCtx {
  user: string;
  ip: string;
}

export interface PersistenceAdapter {
  put(entity: string, id: string, record: unknown): void | Promise<void>;
  get(entity: string, id: string): (unknown | undefined) | Promise<unknown | undefined>;
}

export class InMemoryAdapter implements PersistenceAdapter {
  private readonly store = new Map<string, Map<string, unknown>>();

  put(entity: string, id: string, record: unknown): void {
    let m = this.store.get(entity);
    if (!m) {
      m = new Map();
      this.store.set(entity, m);
    }
    m.set(id, record);
  }

  get(entity: string, id: string): unknown | undefined {
    return this.store.get(entity)?.get(id);
  }
}

export type ValidateResult<T> = { ok: true; value: T } | { ok: false; errors: ReadonlyArray<string> };

export interface IDataContract {
  register(entity: string, schema: ZodType): void;
  validate<T>(entity: string, data: unknown): ValidateResult<T>;
  persist(entity: string, id: string, record: unknown, ctx: PersistCtx): Promise<void>;
  read(entity: string, id: string): Promise<unknown | undefined>;
}

export class DataContract implements IDataContract {
  private readonly schemas = new Map<string, ZodType>();

  constructor(
    private readonly adapter: PersistenceAdapter = new InMemoryAdapter(),
    private readonly onWrite?: (e: { entity: string; id: string; ctx: PersistCtx }) => void,
  ) {}

  register(entity: string, schema: ZodType): void {
    this.schemas.set(entity, schema);
  }

  validate<T>(entity: string, data: unknown): ValidateResult<T> {
    const schema = this.schemas.get(entity);
    if (!schema) return { ok: false, errors: [`chưa đăng ký schema: ${entity}`] };
    const r = schema.safeParse(data);
    if (!r.success) {
      return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
    }
    return { ok: true, value: r.data as T };
  }

  async persist(entity: string, id: string, record: unknown, ctx: PersistCtx): Promise<void> {
    const v = this.validate(entity, record);
    if (!v.ok) throw new Error(`validate fail (${entity}): ${v.errors.join('; ')}`);
    await this.adapter.put(entity, id, record);
    this.onWrite?.({ entity, id, ctx });
  }

  read(entity: string, id: string): Promise<unknown | undefined> {
    return Promise.resolve(this.adapter.get(entity, id));
  }
}
