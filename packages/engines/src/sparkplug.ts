// L0 — Driver MQTT Sparkplug B (doc 16, Eclipse Sparkplug 3.0). Vai trò HOST: nhận NBIRTH/NDATA từ
// edge node hiện trường → giải alias → đẩy TagValue vào kernel (IProtocolDriver.ctx.publish); ghi
// lệnh ra hiện trường bằng NCMD/DCMD. Alias (NBIRTH lập name↔alias, NDATA chỉ gửi alias) xử lý đúng
// chuẩn = phần cốt lõi. Transport MQTT được INJECT → kiểm được KHÔNG cần broker; serialize payload
// pluggable (mặc định JSON; deploy dùng protobuf Tahu) → lõi không phụ thuộc thư viện protobuf/mqtt.
import type { IProtocolDriver, IProtocolDriverContext, IWriteCommand, TagId, TagValue, WriteResult } from '@idtp/sdk';

export type SpMessageType = 'NBIRTH' | 'NDATA' | 'NDEATH' | 'DBIRTH' | 'DDATA' | 'DDEATH' | 'NCMD' | 'DCMD' | 'STATE';

export interface SpMetric {
  readonly name?: string; // có ở BIRTH; DATA có thể chỉ có alias
  readonly alias?: number;
  readonly timestamp?: number;
  readonly value: number | boolean | string;
}
export interface SpPayload {
  readonly timestamp: number;
  readonly seq: number;
  readonly metrics: ReadonlyArray<SpMetric>;
}

/** Truyền tải MQTT — deploy: adapter mqtt.js; test: transport giả. */
export interface MqttTransport {
  publish(topic: string, payload: Uint8Array): Promise<void>;
  subscribe(topicFilter: string, handler: (topic: string, payload: Uint8Array) => void): Promise<void>;
  end(): Promise<void>;
  readonly connected: boolean;
}

/** Serialize payload Sparkplug — mặc định JSON; deploy inject protobuf. */
export interface SpCodec {
  encode(p: SpPayload): Uint8Array;
  decode(b: Uint8Array): SpPayload;
}
export const jsonCodec: SpCodec = {
  encode: (p) => new TextEncoder().encode(JSON.stringify(p)),
  decode: (b) => JSON.parse(new TextDecoder().decode(b)) as SpPayload,
};

export interface SparkplugConfig {
  group: string; // group_id
  edgeNode: string; // edge_node_id của host (cho NCMD do host phát)
  /** Ánh xạ metric Sparkplug (name) → tag id IDTP. Chiều ngược dùng để ghi (write→NCMD). */
  metricMap: Readonly<Record<string, TagId>>;
  namespace?: string; // mặc định 'spBv1.0'
}

function spTopic(ns: string, group: string, type: SpMessageType, edge: string, device?: string): string {
  return device ? `${ns}/${group}/${type}/${edge}/${device}` : `${ns}/${group}/${type}/${edge}`;
}
function qualityOf(v: SpMetric): 'Good' | 'Bad' {
  return v.value === null || v.value === undefined ? 'Bad' : 'Good';
}

export class SparkplugDriver implements IProtocolDriver {
  readonly id = 'mqtt-sparkplug';
  private ctx: IProtocolDriverContext | null = null;
  private cfg: SparkplugConfig | null = null;
  private connected = false;
  private seq = 0;
  private interest: Set<TagId> | null = null; // null = tất cả tag trong metricMap
  private readonly nameToTag = new Map<string, TagId>();
  private readonly tagToName = new Map<TagId, string>();
  // alias→name theo từng node (NBIRTH lập, NDATA dùng)
  private readonly aliasByNode = new Map<string, Map<number, string>>();

  get isConnected(): boolean {
    return this.connected;
  }

  private nodeKey(edge: string, device?: string): string {
    return device ? `${edge}/${device}` : edge;
  }

  async connect(ctx: IProtocolDriverContext, config: unknown): Promise<void> {
    const cfg = config as SparkplugConfig;
    this.ctx = ctx;
    this.cfg = cfg;
    for (const [name, tag] of Object.entries(cfg.metricMap)) {
      this.nameToTag.set(name, tag);
      this.tagToName.set(tag, name);
    }
    const ns = cfg.namespace ?? 'spBv1.0';
    // Host nghe mọi BIRTH/DATA của group (node + device) — filter '#'.
    await this.transport.subscribe(`${ns}/${cfg.group}/#`, (topic, payload) => this.onMessage(topic, payload));
    this.connected = this.transport.connected;
    ctx.logAudit({ event: 'sparkplug-connect', group: cfg.group });
  }

  async subscribe(tagIds: ReadonlyArray<TagId>): Promise<void> {
    this.interest = new Set(tagIds);
  }

  private onMessage(topic: string, payload: Uint8Array): void {
    if (!this.ctx || !this.cfg) return;
    const parts = topic.split('/');
    // ns/group/type/edge[/device]
    const type = parts[2] as SpMessageType | undefined;
    const edge = parts[3];
    const device = parts[4];
    if (!type || !edge) return;
    let msg: SpPayload;
    try {
      msg = this.codec.decode(payload);
    } catch {
      return;
    }
    const key = this.nodeKey(edge, device);
    if (type === 'NBIRTH' || type === 'DBIRTH') {
      const map = this.aliasByNode.get(key) ?? new Map<number, string>();
      for (const m of msg.metrics) if (m.name !== undefined && m.alias !== undefined) map.set(m.alias, m.name);
      this.aliasByNode.set(key, map);
      this.publishMetrics(key, msg.metrics, msg.timestamp); // BIRTH mang giá trị hiện tại
    } else if (type === 'NDATA' || type === 'DDATA') {
      this.publishMetrics(key, msg.metrics, msg.timestamp);
    } else if (type === 'NDEATH' || type === 'DDEATH') {
      this.aliasByNode.delete(key);
    }
  }

  /** Giải metric → tag id (theo name, hoặc alias→name), lọc theo interest, đẩy vào kernel. */
  private publishMetrics(nodeKey: string, metrics: ReadonlyArray<SpMetric>, ts: number): void {
    if (!this.ctx) return;
    const aliases = this.aliasByNode.get(nodeKey);
    const out: TagValue[] = [];
    const tsIso = new Date(ts).toISOString();
    for (const m of metrics) {
      const name = m.name ?? (m.alias !== undefined ? aliases?.get(m.alias) : undefined);
      if (name === undefined) continue;
      const tag = this.nameToTag.get(name);
      if (tag === undefined) continue;
      if (this.interest && !this.interest.has(tag)) continue;
      out.push({ tagId: tag, value: m.value, quality: qualityOf(m), ts: m.timestamp !== undefined ? new Date(m.timestamp).toISOString() : tsIso });
    }
    if (out.length > 0) this.ctx.publish(out);
  }

  /** Ghi ra hiện trường: phát NCMD (name của metric) tới edge node. */
  async write(cmd: IWriteCommand): Promise<WriteResult> {
    if (!this.connected || !this.cfg) return { ok: false, blockedReason: 'sparkplug chưa kết nối' };
    const name = this.tagToName.get(cmd.tagId);
    if (name === undefined) return { ok: false, blockedReason: `không ánh xạ metric cho tag ${cmd.tagId}` };
    const ns = this.cfg.namespace ?? 'spBv1.0';
    const payload: SpPayload = { timestamp: Date.now(), seq: this.nextSeq(), metrics: [{ name, timestamp: Date.now(), value: cmd.value }] };
    await this.transport.publish(spTopic(ns, this.cfg.group, 'NCMD', this.cfg.edgeNode), this.codec.encode(payload));
    this.ctx?.logAudit({ event: 'sparkplug-ncmd', tag: cmd.tagId, metric: name, value: cmd.value, user: cmd.user, reason: cmd.reason });
    return { ok: true };
  }

  private nextSeq(): number {
    const s = this.seq;
    this.seq = (this.seq + 1) % 256; // Sparkplug seq 0..255
    return s;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.aliasByNode.clear();
    await this.transport.end();
  }

  constructor(
    private readonly transport: MqttTransport,
    private readonly codec: SpCodec = jsonCodec,
  ) {}
}
