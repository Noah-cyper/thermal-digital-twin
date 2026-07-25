// Kernel L1 — Namespace/UNS (doc 05-09). Parse/validate 7 segment, resolve 3 chiều
// KKS/UNS/Sparkplug → tag id, cách ly namespace theo plugin (L-P5).
import type { TagId } from '@idtp/sdk';

export interface UnsPath {
  enterprise: string;
  site: string;
  area: string;
  cell: string;
  unit: string;
  equipment: string;
  signal: string;
}

export interface NameMap {
  tagId: TagId;
  kks: string;
  uns: string;
  sparkplug: string;
}

export interface NameRef {
  kks?: string;
  uns?: string;
  sparkplug?: string;
}

export interface INamespace {
  parse(uns: string): UnsPath | { error: string };
  resolve(ref: NameRef): TagId | undefined;
  register(map: NameMap, pluginNamespace: string): { ok: true } | { ok: false; reason: string };
  toSparkplug(tagId: TagId): string | undefined;
  allocatePrefix(pluginId: string): string;
}

const UNS_RE = /^[a-z0-9-]+(?:\/[a-z0-9-]+){6}$/;

export class Namespace implements INamespace {
  private readonly byTagId = new Map<TagId, NameMap>();
  private readonly byKks = new Map<string, TagId>();
  private readonly byUns = new Map<string, TagId>();
  private readonly bySpark = new Map<string, TagId>();
  private readonly owner = new Map<TagId, string>();
  private readonly prefixes = new Set<string>();

  parse(uns: string): UnsPath | { error: string } {
    if (!UNS_RE.test(uns)) return { error: `UNS phải đủ 7 segment chữ thường: ${uns}` };
    const parts = uns.split('/');
    return {
      enterprise: parts[0] ?? '',
      site: parts[1] ?? '',
      area: parts[2] ?? '',
      cell: parts[3] ?? '',
      unit: parts[4] ?? '',
      equipment: parts[5] ?? '',
      signal: parts[6] ?? '',
    };
  }

  resolve(ref: NameRef): TagId | undefined {
    if (ref.uns !== undefined) return this.byUns.get(ref.uns);
    if (ref.kks !== undefined) return this.byKks.get(ref.kks);
    if (ref.sparkplug !== undefined) return this.bySpark.get(ref.sparkplug);
    return undefined;
  }

  register(map: NameMap, pluginNamespace: string): { ok: true } | { ok: false; reason: string } {
    const parsed = this.parse(map.uns);
    if ('error' in parsed) return { ok: false, reason: parsed.error };

    const existing = this.byUns.get(map.uns);
    if (existing !== undefined) {
      const owner = this.owner.get(existing);
      return {
        ok: false,
        reason: owner === pluginNamespace ? `UNS trùng: ${map.uns}` : `UNS thuộc plugin khác: ${map.uns}`,
      };
    }
    if (map.kks.length > 0 && this.byKks.has(map.kks)) {
      return { ok: false, reason: `KKS trùng: ${map.kks}` };
    }

    this.byTagId.set(map.tagId, map);
    this.byUns.set(map.uns, map.tagId);
    if (map.kks.length > 0) this.byKks.set(map.kks, map.tagId);
    if (map.sparkplug.length > 0) this.bySpark.set(map.sparkplug, map.tagId);
    this.owner.set(map.tagId, pluginNamespace);
    return { ok: true };
  }

  toSparkplug(tagId: TagId): string | undefined {
    return this.byTagId.get(tagId)?.sparkplug;
  }

  allocatePrefix(pluginId: string): string {
    this.prefixes.add(pluginId);
    return pluginId;
  }
}
