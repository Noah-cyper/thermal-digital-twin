// Kernel L1 — Asset Model (doc 05-10). Cây thiết bị ISA-95/88 (adjacency), asset↔tag,
// tách khỏi cây điều hướng ISA-101.
import type { TagId } from '@idtp/sdk';

export type AssetLevel =
  | 'Enterprise'
  | 'Site'
  | 'Area'
  | 'Cell'
  | 'Unit'
  | 'EquipmentModule'
  | 'ControlModule';

export interface AssetNode {
  assetId: string;
  level: AssetLevel;
  name: string;
  parentId?: string;
  kks?: string;
  equipmentModule?: string;
}

export interface IAssetModel {
  load(nodes: ReadonlyArray<AssetNode>, pluginNamespace: string): { ok: true } | { ok: false; reason: string };
  get(assetId: string): AssetNode | undefined;
  children(assetId: string): ReadonlyArray<AssetNode>;
  path(assetId: string): ReadonlyArray<AssetNode>;
  linkTag(assetId: string, tagId: TagId): void;
  tagsOf(assetId: string): ReadonlyArray<TagId>;
}

export class AssetModel implements IAssetModel {
  private readonly nodes = new Map<string, AssetNode>();
  private readonly childrenIdx = new Map<string, string[]>();
  private readonly tagsByAsset = new Map<string, TagId[]>();
  private readonly owner = new Map<string, string>();

  load(nodes: ReadonlyArray<AssetNode>, pluginNamespace: string): { ok: true } | { ok: false; reason: string } {
    for (const n of nodes) {
      if (this.nodes.has(n.assetId) && this.owner.get(n.assetId) !== pluginNamespace) {
        return { ok: false, reason: `assetId thuộc plugin khác: ${n.assetId}` };
      }
    }
    const incoming = new Set(nodes.map((n) => n.assetId));
    for (const n of nodes) {
      if (n.parentId !== undefined && !incoming.has(n.parentId) && !this.nodes.has(n.parentId)) {
        return { ok: false, reason: `node mồ côi (parent thiếu): ${n.assetId} → ${n.parentId}` };
      }
    }
    for (const n of nodes) {
      this.nodes.set(n.assetId, n);
      this.owner.set(n.assetId, pluginNamespace);
      if (n.parentId !== undefined) {
        const arr = this.childrenIdx.get(n.parentId) ?? [];
        if (!arr.includes(n.assetId)) arr.push(n.assetId);
        this.childrenIdx.set(n.parentId, arr);
      }
    }
    return { ok: true };
  }

  get(assetId: string): AssetNode | undefined {
    return this.nodes.get(assetId);
  }

  children(assetId: string): ReadonlyArray<AssetNode> {
    const ids = this.childrenIdx.get(assetId) ?? [];
    const out: AssetNode[] = [];
    for (const id of ids) {
      const n = this.nodes.get(id);
      if (n) out.push(n);
    }
    return out;
  }

  path(assetId: string): ReadonlyArray<AssetNode> {
    const out: AssetNode[] = [];
    const seen = new Set<string>();
    let cur = this.nodes.get(assetId);
    while (cur && !seen.has(cur.assetId)) {
      seen.add(cur.assetId);
      out.unshift(cur);
      cur = cur.parentId !== undefined ? this.nodes.get(cur.parentId) : undefined;
    }
    return out;
  }

  linkTag(assetId: string, tagId: TagId): void {
    const arr = this.tagsByAsset.get(assetId) ?? [];
    if (!arr.includes(tagId)) arr.push(tagId);
    this.tagsByAsset.set(assetId, arr);
  }

  tagsOf(assetId: string): ReadonlyArray<TagId> {
    return this.tagsByAsset.get(assetId) ?? [];
  }
}
