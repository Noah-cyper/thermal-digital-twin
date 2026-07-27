// @idtp/sdk — hợp đồng REGISTRY & SEED (doc 04 §6, doc 07). Plugin CUNG CẤP spec khai báo
// (template thiết bị + nhóm instance + template alarm); SeedGenerator (@idtp/engines) EXPAND thành
// registry đầy đủ. Nhờ khai báo, mở rộng tới quy mô §10 (≥ 3.000 tag / ≥ 600 alarm) = thêm DỮ LIỆU,
// không sửa engine/kernel — cùng luận điểm "mọi nhà máy chỉ là plugin".
import type { AlarmCondition, AlarmDef, Priority } from './alarm';

export type TagDatatype = 'float' | 'bool' | 'int' | 'string';
export type ScanClass = 'fast' | 'process' | 'slow' | 'diag'; // 250ms | 500ms | 1s | 5s (doc 07 §2)
export type TagSource = 'sim' | 'opcua' | 'modbus' | 'calc';
export type RetentionClass = 'standard' | 'extended' | 'totalizer'; // doc 19

/**
 * Bản ghi tag chuẩn (doc 04 §6.3 — schema Zod). Khoá tham chiếu = `id` (UUID); KKS/UNS/Sparkplug là
 * attribute. `quality` KHÔNG nằm đây (là trường runtime của TagValue). 19 trường tĩnh.
 */
export interface TagRecord {
  readonly id: string; // UUID tất định theo tên
  readonly kks: string; // VGB-B 106, có thể [GIẢ ĐỊNH]
  readonly uns: string; // 7 segment (doc 04 §4)
  readonly name: string; // fallback name AREA_SYS_EQUIP_SUFFIX_NN
  readonly descVi: string;
  readonly descEn: string;
  readonly datatype: TagDatatype;
  readonly eu: string; // engineering unit
  readonly rangeLo: number;
  readonly rangeHi: number;
  readonly deadband: number; // theo EU
  readonly scanClass: ScanClass;
  readonly source: TagSource;
  readonly assetId: string; // trỏ control module
  readonly alarmIds: ReadonlyArray<string>; // trỏ doc 08 (back-link)
  readonly retentionClass: RetentionClass;
  readonly securityLevel: number; // vai tối thiểu để ghi (0 = chỉ đọc)
  readonly isWritable: boolean;
  readonly simModelRef: string; // trỏ ISimModel.id ('' nếu không mô phỏng)
}

/** Một dòng tag trong template thiết bị (doc 07 §3, templates.tags.yaml). */
export interface TagTemplateEntry {
  readonly suffix: string; // vd RUN, CURRENT, BRG_VIB
  readonly datatype: TagDatatype;
  readonly eu?: string;
  readonly scan: ScanClass;
  readonly alarm?: boolean; // có ứng viên alarm không (chỉ sinh nếu khớp AlarmTemplateEntry)
  readonly writable?: boolean;
  readonly rangeLo?: number; // ghi đè range mặc định theo EU
  readonly rangeHi?: number;
}

/** Template tag theo loại thiết bị. `ref` = kế thừa entries của template khác (vd fan → motor_pump). */
export interface TagTemplate {
  readonly type: string;
  readonly ref?: string;
  readonly tags?: ReadonlyArray<TagTemplateEntry>;
}

/**
 * Nhóm instance cùng loại thiết bị trong một hệ (doc 07 §5 bước 2). Expand thành `count` instance
 * đánh số 01..count; mỗi instance sinh 1 tag / dòng template.
 */
export interface InstanceGroup {
  readonly template: string; // trỏ TagTemplate.type
  readonly area: string; // UNS area slug, vd 'unit1'
  readonly cell: string; // UNS cell slug, vd 'boiler'
  readonly unit: string; // UNS unit slug, vd 'pulverizer'
  readonly equip: string; // UNS equipment prefix, vd 'mill' → mill-01..
  readonly count: number;
  readonly namePrefix: string; // fallback name prefix, vd 'BLR_MILL' → BLR_MILL_01_CURRENT
  readonly kksSystem: string; // KKS function key G1G2G3, vd 'HFC'
  readonly kksUnit?: string; // KKS unit number, mặc định '10'
  readonly descVi: string;
  readonly descEn: string;
  readonly source?: TagSource; // mặc định 'opcua' (điểm hiện trường); boiler core dùng 'sim'
  readonly simModelRef?: string;
  readonly securityBase?: number; // security_level cho tag writable, mặc định 2
  readonly retention?: RetentionClass; // mặc định 'standard'
}

/** Cách suy setpoint alarm từ range của tag (breadth — [GIẢ ĐỊNH], hiệu chỉnh khi rationalize thật). */
export type SetpointRule = 'rangeHi' | 'rangeHiWarn' | 'rangeLoWarn' | 'rangeLo' | 'discreteTrue';

/** Template alarm theo suffix tag (doc 08 §3). Chỉ suffix có mặt ở đây mới sinh alarm → kiểm soát
 *  tổng số alarm ở mức rationalized (ISA-18.2 chống alarm flood), không phải "mọi tag một alarm". */
export interface AlarmTemplateEntry {
  readonly suffix: string; // khớp TagTemplateEntry.suffix
  readonly condition: AlarmCondition;
  readonly priority: Priority;
  readonly setpointRule: SetpointRule;
  readonly deadbandPct?: number; // % span, mặc định 1
  readonly onDelayMs: number;
  readonly offDelayMs: number;
  readonly consequenceVi: string;
  readonly consequenceEn: string;
  readonly correctiveVi?: string;
  readonly correctiveEn?: string;
}

/** Spec seed toàn plugin (doc 07 §5). Plugin cung cấp; SeedGenerator expand. */
export interface PlantSeedSpec {
  readonly enterprise: string; // UNS enterprise slug, vd 'hoantran'
  readonly site: string; // UNS site slug, vd 'haiphong'
  readonly idNamespace: string; // prefix id theo plugin (doc 04 §7 cách ly namespace)
  readonly templates: ReadonlyArray<TagTemplate>;
  readonly instances: ReadonlyArray<InstanceGroup>;
  readonly alarmTemplates: ReadonlyArray<AlarmTemplateEntry>;
}

/** Kết quả expand — registry đầy đủ + số liệu roll-up (doc 07 §4, GĐ-14 phân bố scan class). */
export interface SeededRegistry {
  readonly tags: ReadonlyArray<TagRecord>;
  readonly alarms: ReadonlyArray<AlarmDef>;
  readonly byCell: Readonly<Record<string, number>>; // cell slug → số tag
  readonly byScanClass: Readonly<Record<ScanClass, number>>;
}
