// @idtp/engines — SeedGenerator (doc 07 §5). Expand PlantSeedSpec KHAI BÁO của plugin thành registry
// đầy đủ (TagRecord[] + AlarmDef[]). Engine GENERIC: không hiểu biết plant cụ thể — mọi tri thức
// thermal nằm trong spec của plugin. Thuần & tất định: id UUID suy từ tên (KHÔNG Math.random), cùng
// spec → cùng registry. Nhờ vậy đạt quy mô §10 (≥ 3.000 tag / ≥ 600 alarm) mà 0 dòng sửa kernel.
import type {
  AlarmDef,
  AlarmTemplateEntry,
  InstanceGroup,
  PlantSeedSpec,
  ScanClass,
  SeededRegistry,
  SetpointRule,
  TagRecord,
  TagTemplate,
  TagTemplateEntry,
} from '@idtp/sdk';

/* ── UUID tất định (cyrb53 → splitmix32 → 16 byte). Không phụ thuộc node:crypto, không Math.random ── */
function cyrb53(str: string): [number, number] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

function deterministicUuid(name: string): string {
  const [a, b] = cyrb53(name);
  let s = (a ^ 0x9e3779b9) >>> 0;
  s = (s ^ b) >>> 0;
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    bytes.push(((t ^ (t >>> 14)) >>> 0) & 0xff);
  }
  const at = (i: number): number => bytes[i] ?? 0;
  const b6 = (at(6) & 0x0f) | 0x40; // version 4 nibble
  const b8 = (at(8) & 0x3f) | 0x80; // variant
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    const v = i === 6 ? b6 : i === 8 ? b8 : at(i);
    hex.push(v.toString(16).padStart(2, '0'));
  }
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/* ── Suy mã đo KKS từ suffix (VGB-B 106, doc 04 §5). Breadth = [GIẢ ĐỊNH], hiệu chỉnh sau (GĐ-04). ── */
const KKS_COMPONENT: Readonly<Record<string, string>> = {
  DISCH_PRESS: 'CP',
  DP: 'CP',
  SEAL_AIR: 'CP',
  OUTLET_TEMP: 'CT',
  BRG_TEMP: 'CT',
  BRG_TEMP_DE: 'CT',
  BRG_TEMP_NDE: 'CT',
  WIND_TEMP: 'CT',
  IN_TEMP: 'CT',
  OUT_TEMP: 'CT',
  FLOW: 'CF',
  PA_FLOW: 'CF',
  LEVEL: 'CL',
  VALUE: 'CQ',
  OUTLET_O2: 'CQ',
  RANGE: 'CQ',
  BRG_VIB: 'CY',
  POS_FB: 'CG',
  OP: 'CG',
  FEEDER_SPD: 'CG',
  CURRENT: 'CE',
  VOLTAGE: 'CE',
};
function kksComponent(suffix: string): string {
  return KKS_COMPONENT[suffix] ?? 'GH'; // GH = generic
}

/* ── Range mặc định theo EU (khi template không ghi đè) ── */
const EU_RANGE: Readonly<Record<string, [number, number]>> = {
  degC: [0, 600],
  MPa: [0, 25],
  kPa: [0, 100],
  't/h': [0, 3000],
  'm3/h': [0, 5000],
  mm: [-500, 500],
  '%': [0, 100],
  A: [0, 1000],
  kV: [0, 550],
  'mm/s': [0, 30],
};
function defaultRange(entry: TagTemplateEntry): [number, number] {
  if (entry.rangeLo !== undefined && entry.rangeHi !== undefined) return [entry.rangeLo, entry.rangeHi];
  if (entry.datatype === 'bool') return [0, 1];
  if (entry.eu !== undefined) {
    const r = EU_RANGE[entry.eu];
    if (r) return r;
  }
  return [0, 100];
}

/* ── Giải template + kế thừa ref (vd fan → motor_pump) ── */
function resolveTemplateEntries(
  templates: ReadonlyArray<TagTemplate>,
  type: string,
  seen: ReadonlyArray<string> = [],
): ReadonlyArray<TagTemplateEntry> {
  const tpl = templates.find((t) => t.type === type);
  if (!tpl) throw new Error(`SeedGenerator: template không tồn tại: '${type}'`);
  if (tpl.ref) {
    if (seen.includes(tpl.ref)) throw new Error(`SeedGenerator: vòng lặp ref template: '${tpl.ref}'`);
    const base = resolveTemplateEntries(templates, tpl.ref, [...seen, type]);
    return [...base, ...(tpl.tags ?? [])];
  }
  return tpl.tags ?? [];
}

function computeSetpoint(rule: SetpointRule, lo: number, hi: number): number {
  const span = hi - lo;
  switch (rule) {
    case 'rangeHi':
      return hi;
    case 'rangeLo':
      return lo;
    case 'rangeHiWarn':
      return lo + 0.9 * span;
    case 'rangeLoWarn':
      return lo + 0.1 * span;
    case 'discreteTrue':
      return 1;
  }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * Expand spec khai báo thành registry đầy đủ. Ném lỗi nếu trùng tag name hoặc alarm id (bất biến
 * "khoá duy nhất" doc 04 §4) — an toàn hơn im lặng ghi đè.
 */
export function generateRegistry(spec: PlantSeedSpec): SeededRegistry {
  const tags: TagRecord[] = [];
  const alarms: AlarmDef[] = [];
  const byCell: Record<string, number> = {};
  const byScanClass: Record<ScanClass, number> = { fast: 0, process: 0, slow: 0, diag: 0 };
  const tagNames = new Set<string>();
  const alarmIds = new Set<string>();

  const alarmBySuffix = new Map<string, AlarmTemplateEntry[]>();
  for (const at of spec.alarmTemplates) {
    const list = alarmBySuffix.get(at.suffix) ?? [];
    list.push(at);
    alarmBySuffix.set(at.suffix, list);
  }

  for (const g of spec.instances) {
    const entries = resolveTemplateEntries(spec.templates, g.template);
    const kksUnit = g.kksUnit ?? '10';
    const source = g.source ?? 'opcua';
    const retention = g.retention ?? 'standard';
    const simRef = g.simModelRef ?? '';
    const securityBase = g.securityBase ?? 2;

    for (let inst = 1; inst <= g.count; inst++) {
      const nn = pad(inst, 2);
      const equipSlug = `${g.equip.toLowerCase()}-${nn}`;
      let sfxIdx = 0;
      for (const e of entries) {
        sfxIdx++;
        const name = `${g.namePrefix}_${nn}_${e.suffix}`;
        if (tagNames.has(name)) throw new Error(`SeedGenerator: trùng tag name '${name}'`);
        tagNames.add(name);

        const signal = e.suffix.toLowerCase().replace(/_/g, '-');
        const uns = `${spec.enterprise}/${spec.site}/${g.area}/${g.cell}/${g.unit}/${equipSlug}/${signal}`;
        const [rangeLo, rangeHi] = defaultRange(e);
        const eu = e.eu ?? '';
        const writable = e.writable ?? false;
        const kks = `${kksUnit}${g.kksSystem}${nn}${kksComponent(e.suffix)}${pad(sfxIdx, 3)}`;

        // alarm(s) cho tag này (nếu entry là ứng viên & có template khớp suffix)
        const myAlarmIds: string[] = [];
        if (e.alarm) {
          for (const at of alarmBySuffix.get(e.suffix) ?? []) {
            const alarmId = `${name}-${at.condition}`;
            if (alarmIds.has(alarmId)) throw new Error(`SeedGenerator: trùng alarm id '${alarmId}'`);
            alarmIds.add(alarmId);
            myAlarmIds.push(alarmId);
            const span = rangeHi - rangeLo;
            const setpoint = computeSetpoint(at.setpointRule, rangeLo, rangeHi);
            const deadband =
              at.setpointRule === 'discreteTrue' ? 0.5 : Math.max(((at.deadbandPct ?? 1) / 100) * span, 0);
            alarms.push({
              alarmId,
              tagId: name,
              condition: at.condition,
              priority: at.priority,
              setpoint,
              deadband,
              onDelayMs: at.onDelayMs,
              offDelayMs: at.offDelayMs,
              consequence: { vi: at.consequenceVi, en: at.consequenceEn },
              ...(at.correctiveVi !== undefined && at.correctiveEn !== undefined
                ? { corrective: { vi: at.correctiveVi, en: at.correctiveEn } }
                : {}),
            });
          }
        }

        tags.push({
          id: deterministicUuid(`${spec.idNamespace}:${name}`),
          kks,
          uns,
          name,
          descVi: `${g.descVi} ${nn} — ${e.suffix}`,
          descEn: `${g.descEn} ${nn} — ${e.suffix}`,
          datatype: e.datatype,
          eu,
          rangeLo,
          rangeHi,
          deadband: e.datatype === 'float' ? Math.max((rangeHi - rangeLo) * 0.01, 0) : 0,
          scanClass: e.scan,
          source,
          assetId: deterministicUuid(`${spec.idNamespace}:asset:${g.namePrefix}_${nn}`),
          alarmIds: myAlarmIds,
          retentionClass: retention,
          securityLevel: writable ? securityBase : 0,
          isWritable: writable,
          simModelRef: simRef,
        });
        byCell[g.cell] = (byCell[g.cell] ?? 0) + 1;
        byScanClass[e.scan]++;
      }
    }
  }

  return { tags, alarms, byCell, byScanClass };
}
