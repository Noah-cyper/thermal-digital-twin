// Kernel L1 — Config Store (doc 05-13). Versioned config, Zod theo key, hot-reload (watch),
// namespace theo plugin (chia sẻ store, tiền tố key).
import type { ZodType } from 'zod';

export type ConfigWatcher<T> = (value: T) => void;

export interface IConfigStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): { ok: true } | { ok: false; errors: ReadonlyArray<string> };
  watch<T>(key: string, cb: ConfigWatcher<T>): () => void;
  registerSchema(key: string, schema: ZodType): void;
  namespace(pluginId: string): IConfigStore;
}

interface ConfigState {
  values: Map<string, unknown>;
  schemas: Map<string, ZodType>;
  watchers: Map<string, Set<(v: unknown) => void>>;
}

export class ConfigStore implements IConfigStore {
  private readonly state: ConfigState;

  constructor(
    private readonly prefix = '',
    state?: ConfigState,
  ) {
    this.state = state ?? { values: new Map(), schemas: new Map(), watchers: new Map() };
  }

  private k(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  registerSchema(key: string, schema: ZodType): void {
    this.state.schemas.set(this.k(key), schema);
  }

  get<T>(key: string): T | undefined {
    return this.state.values.get(this.k(key)) as T | undefined;
  }

  set<T>(key: string, value: T): { ok: true } | { ok: false; errors: ReadonlyArray<string> } {
    const full = this.k(key);
    const schema = this.state.schemas.get(full);
    if (schema) {
      const r = schema.safeParse(value);
      if (!r.success) {
        return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
      }
    }
    this.state.values.set(full, value);
    const ws = this.state.watchers.get(full);
    if (ws) {
      for (const w of [...ws]) {
        try {
          w(value);
        } catch {
          // isolate watcher errors
        }
      }
    }
    return { ok: true };
  }

  watch<T>(key: string, cb: ConfigWatcher<T>): () => void {
    const full = this.k(key);
    let set = this.state.watchers.get(full);
    if (!set) {
      set = new Set();
      this.state.watchers.set(full, set);
    }
    const wrapped = (v: unknown): void => cb(v as T);
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  namespace(pluginId: string): IConfigStore {
    const p = this.prefix ? `${this.prefix}:${pluginId}` : pluginId;
    return new ConfigStore(p, this.state);
  }
}
