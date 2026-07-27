// @idtp/sdk — kiểu cây điều hướng ISA-101 (doc 05-16 / doc 13). TÁCH khỏi cây thiết bị (ISA-95).
// Plugin khai báo nav/tree; Navigation Engine ép luật (§7) + phân giải alarm→màn hình. Kernel render.
import type { ScreenLevel } from './graphics';

export interface NavNode {
  readonly screenId: string;
  readonly level: ScreenLevel;
  readonly title: { vi: string; en: string };
  readonly parentId?: string;
  readonly hotkey?: number;
}
