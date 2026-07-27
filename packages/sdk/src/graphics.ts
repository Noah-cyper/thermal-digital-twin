// @idtp/sdk — kiểu màn hình KHAI BÁO (doc 05-02 / doc 12). Plugin CUNG CẤP screen dưới dạng dữ liệu;
// Graphics Runtime (@idtp/engines) render bằng binding {property, tag, transform, condition}.
// Cấm hardcode màn hình process trong React — màn hình = JSON khai báo, kernel render.
import type { TagId } from './types';

export type ScreenLevel = 'D1' | 'D2' | 'D3' | 'D4' | 'S';

export interface TransformSpec {
  readonly kind: 'linear' | 'map';
  readonly scale?: number;
  readonly offset?: number;
  readonly map?: Record<string, string>;
}

export interface ConditionSpec {
  readonly when: 'gt' | 'lt' | 'eq' | 'bad';
  readonly value?: number;
  readonly then: Record<string, string>;
}

export interface Binding {
  readonly property: string;
  readonly tag: TagId;
  readonly transform?: TransformSpec;
  readonly condition?: ConditionSpec;
}

export interface ScreenElement {
  readonly id: string;
  readonly symbol: string; // kiểu symbol client render: value · bar · pipe · label · state
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  readonly label?: string; // nhãn hiển thị (metadata, engine bỏ qua)
  readonly unit?: string; // đơn vị EU (metadata)
  readonly bindings: ReadonlyArray<Binding>;
}

export interface ScreenDef {
  readonly screenId: string;
  readonly level: ScreenLevel;
  readonly title?: { vi: string; en: string };
  readonly elements: ReadonlyArray<ScreenElement>;
}
