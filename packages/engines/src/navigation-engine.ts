// L2 — Navigation Engine (doc 05-16, ISA-101). Chạy cây điều hướng KHAI BÁO của plugin; dựng index
// alarm→D3 (qua tag của alarm + tag mà màn hình hiển thị) để nhảy ≤ 1 thao tác; breadcrumb; hotkey.
// Generic: engine không biết plugin cụ thể. History back/forward là việc của client (theo phiên).
import type { NavNode, AlarmDef, ScreenDef } from '@idtp/sdk';

export interface NavigationSources {
  alarms: ReadonlyArray<AlarmDef>;
  screens: ReadonlyArray<ScreenDef>;
}

export class NavigationEngine {
  private readonly nodes: ReadonlyArray<NavNode>;
  private readonly byId = new Map<string, NavNode>();
  private readonly hotkeys = new Map<number, string>();
  private readonly alarmToScreen = new Map<string, string>();

  constructor(nodes: ReadonlyArray<NavNode>, sources: NavigationSources) {
    this.nodes = nodes;
    for (const n of nodes) {
      this.byId.set(n.screenId, n);
      if (n.hotkey !== undefined) this.hotkeys.set(n.hotkey, n.screenId);
    }
    // tag → màn hình (ưu tiên D3 detail hơn D1 tổng quan)
    const tagToScreen = new Map<string, { screenId: string; level: string }>();
    for (const s of sources.screens) {
      for (const el of s.elements) {
        for (const b of el.bindings) {
          const cur = tagToScreen.get(b.tag);
          if (cur === undefined || (s.level === 'D3' && cur.level !== 'D3')) tagToScreen.set(b.tag, { screenId: s.screenId, level: s.level });
        }
      }
    }
    for (const a of sources.alarms) {
      const scr = tagToScreen.get(a.tagId);
      if (scr) this.alarmToScreen.set(a.alarmId, scr.screenId);
    }
  }

  tree(): ReadonlyArray<NavNode> {
    return this.nodes;
  }

  /** Màn hình D1 (về D1 ≤ 1 thao tác). */
  home(): string {
    return this.nodes.find((n) => n.level === 'D1')?.screenId ?? this.nodes[0]?.screenId ?? '';
  }

  /** Đường breadcrumb gốc → screenId (theo parentId). */
  breadcrumb(screenId: string): ReadonlyArray<NavNode> {
    const path: NavNode[] = [];
    let cur = this.byId.get(screenId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.screenId)) {
      seen.add(cur.screenId);
      path.unshift(cur);
      cur = cur.parentId !== undefined ? this.byId.get(cur.parentId) : undefined;
    }
    return path;
  }

  byHotkey(n: number): string | undefined {
    return this.hotkeys.get(n);
  }

  /** alarm → màn hình D3 chứa tag; không có → fallback D1 (doc §7.2). */
  resolveAlarm(alarmId: string): string {
    return this.alarmToScreen.get(alarmId) ?? this.home();
  }

  alarmIndex(): Record<string, string> {
    return Object.fromEntries(this.alarmToScreen);
  }
}
