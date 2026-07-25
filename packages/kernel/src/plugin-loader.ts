// Kernel L1 — Plugin Loader / Factory (doc 05-08). Validate manifest (Zod) + engineApi semver,
// kiểm requires, cấp namespace, vòng đời + cách ly. Kernel KHÔNG hardcode tên plugin.
import { PluginManifest } from '@idtp/sdk';
import type { PluginManifest as ManifestT, EngineName } from '@idtp/sdk';
import { satisfies, valid } from 'semver';

export type PluginPhase = 'Validated' | 'Registered' | 'Started' | 'Stopped' | 'Unloaded' | 'Rejected';

export interface LoadedPlugin {
  id: string;
  version: string;
  phase: PluginPhase;
  namespace: string;
}

export interface PluginLoaderOptions {
  /** phiên bản engineApi của kernel, vd "1.0.0" */
  engineApi: string;
  availableEngines: ReadonlySet<EngineName>;
  availableProtocols: ReadonlySet<string>;
  onLifecycle?: (plugin: LoadedPlugin) => void;
}

export type PluginValidateResult =
  | { ok: true; manifest: ManifestT }
  | { ok: false; errors: ReadonlyArray<string> };

export class PluginRejected extends Error {
  constructor(public readonly errors: ReadonlyArray<string>) {
    super(`plugin bị từ chối: ${errors.join('; ')}`);
    this.name = 'PluginRejected';
  }
}

export class PluginLoader {
  private readonly registry = new Map<string, LoadedPlugin>();

  constructor(private readonly opts: PluginLoaderOptions) {
    if (!valid(opts.engineApi)) throw new Error(`engineApi kernel không hợp lệ: ${opts.engineApi}`);
  }

  validate(obj: unknown): PluginValidateResult {
    const parsed = PluginManifest.safeParse(obj);
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
    }
    const m = parsed.data;
    if (!satisfies(this.opts.engineApi, m.plugin.engineApi)) {
      return {
        ok: false,
        errors: [`engineApi kernel ${this.opts.engineApi} không khớp yêu cầu ${m.plugin.engineApi}`],
      };
    }
    return { ok: true, manifest: m };
  }

  register(obj: unknown): LoadedPlugin {
    const v = this.validate(obj);
    if (!v.ok) throw new PluginRejected(v.errors);
    const m = v.manifest;

    if (this.registry.has(m.plugin.id)) throw new Error(`plugin đã nạp: ${m.plugin.id}`);

    const missingEngines = m.requires.engines.filter((e) => !this.opts.availableEngines.has(e));
    if (missingEngines.length > 0) throw new Error(`thiếu engine: ${missingEngines.join(', ')}`);

    const missingProtocols = m.requires.protocols.filter((p) => !this.opts.availableProtocols.has(p));
    if (missingProtocols.length > 0) throw new Error(`thiếu protocol: ${missingProtocols.join(', ')}`);

    const lp: LoadedPlugin = {
      id: m.plugin.id,
      version: m.plugin.version,
      phase: 'Registered',
      namespace: m.plugin.id,
    };
    this.registry.set(lp.id, lp);
    this.opts.onLifecycle?.(lp);
    return lp;
  }

  start(id: string): LoadedPlugin {
    return this.transition(id, 'Started');
  }

  stop(id: string): LoadedPlugin {
    return this.transition(id, 'Stopped');
  }

  unload(id: string): void {
    this.transition(id, 'Unloaded');
    this.registry.delete(id);
  }

  list(): ReadonlyArray<LoadedPlugin> {
    return [...this.registry.values()];
  }

  private transition(id: string, phase: PluginPhase): LoadedPlugin {
    const lp = this.registry.get(id);
    if (!lp) throw new Error(`plugin chưa nạp: ${id}`);
    lp.phase = phase;
    this.opts.onLifecycle?.(lp);
    return lp;
  }
}
