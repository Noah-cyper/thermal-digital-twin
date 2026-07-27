// @idtp/sdk — kiểu Faceplate (doc 05-15). 4 tab CỐ ĐỊNH (Overview/Trend/Alarm/Detail). Plugin cung
// cấp FaceplateDef khai báo (faceplates/*.fp.json); Faceplate Engine ráp dữ liệu tab từ các engine
// khác. Plugin KHÔNG chứa component UI.
import type { TagId } from './types';

export type FaceplateTab = 'Overview' | 'Trend' | 'Alarm' | 'Detail';

export interface FaceplateDef {
  readonly faceplateId: string;
  readonly assetId: string;
  readonly title: { vi: string; en: string };
  readonly loopId?: string; // control loop gắn với thiết bị (mode + OP)
  readonly pvTag: TagId;
  readonly sp?: number; // SP cố định (nếu không có spTag)
  readonly spTag?: TagId;
  readonly opTag?: TagId;
  readonly eu?: string;
  readonly rangeLo?: number;
  readonly rangeHi?: number;
  readonly kks?: string;
  readonly alarmIds?: ReadonlyArray<string>; // tab Alarm
  readonly trendTags?: ReadonlyArray<TagId>; // tab Trend
  readonly tabs?: ReadonlyArray<FaceplateTab>; // mặc định cả 4
}
