// (5) Lớp DEPLOY — nối adapter THẬT (pg / mqtt.js) vào runtime, BẬT bằng env. Base app KHÔNG phụ
// thuộc cứng pg/mqtt: import ĐỘNG qua specifier biến (tsc/esbuild không phân giải → không cần cài khi
// chạy bản demo). Engine đã DI + test sẵn: TimescaleHistorian (ghi đệm + batch ≥ 50.000 điểm/s,
// loadgen-benchmark), Sparkplug jsonCodec. CHẠY THẬT cần TimescaleDB + broker MQTT — xem docker-compose.yml.
import { TimescaleHistorian, jsonCodec } from '@idtp/engines';
import type { SqlExecutor, MqttTransport, SpPayload } from '@idtp/engines';

export interface PersistenceOpts {
  timescaleUrl?: string; // IDTP_TIMESCALE_URL — postgres://user:pass@host:5432/db
  mqttUrl?: string; // IDTP_MQTT_URL — mqtt://host:1883
  group?: string; // Sparkplug group_id
  edgeNode?: string; // Sparkplug edge_node_id
  intervalMs?: number; // chu kỳ ghi/publish (ms)
}

/** Chỉ cần 2 hàm này từ runtime — dễ mock trong test. */
export interface RuntimeTagSource {
  recordedTags(): ReadonlyArray<string>;
  value(tagId: string): number;
}

// ── Adapter THẬT (import động qua specifier biến → optional dep) ──────────────────────────────
async function pgExecutor(url: string): Promise<{ sql: SqlExecutor; close: () => Promise<void> }> {
  const spec = 'pg';
  const pg: any = await import(spec);
  const Pool = pg.Pool ?? pg.default?.Pool;
  const pool = new Pool({ connectionString: url });
  return {
    sql: { exec: (q, params) => pool.query(q, params as unknown[]) },
    close: () => pool.end(),
  };
}

async function mqttTransport(url: string): Promise<MqttTransport> {
  const spec = 'mqtt';
  const mqtt: any = await import(spec);
  const connect = mqtt.connect ?? mqtt.default?.connect;
  const client = connect(url);
  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('error', (e: Error) => reject(e));
  });
  return {
    get connected(): boolean {
      return !!client.connected;
    },
    publish: (topic, payload) =>
      new Promise<void>((res, rej) => client.publish(topic, Buffer.from(payload), (e?: Error) => (e ? rej(e) : res()))),
    subscribe: (filter, handler) =>
      new Promise<void>((res, rej) => {
        client.on('message', (t: string, p: Buffer) => handler(t, new Uint8Array(p)));
        client.subscribe(filter, (e?: Error) => (e ? rej(e) : res()));
      }),
    end: () => new Promise<void>((res) => client.end(false, {}, () => res())),
  };
}

// ── Bridge: đọc tag hiện tại theo chu kỳ → ghi Historian bền + publish Sparkplug NDATA ───────────
/** Nối persistence THẬT. `deps` cho phép test inject adapter giả (không cần pg/mqtt). Trả stop(). */
export async function startPersistence(
  rt: RuntimeTagSource,
  opts: PersistenceOpts,
  deps?: { makeSql?: (url: string) => Promise<{ sql: SqlExecutor; close: () => Promise<void> }>; makeMqtt?: (url: string) => Promise<MqttTransport> },
): Promise<() => Promise<void>> {
  const intervalMs = opts.intervalMs ?? 1000;
  const ns = 'spBv1.0';
  const group = opts.group ?? 'IDTP';
  const edge = opts.edgeNode ?? 'thermal-600';
  const stops: Array<() => Promise<void>> = [];

  let hist: TimescaleHistorian | undefined;
  if (opts.timescaleUrl) {
    const { sql, close } = await (deps?.makeSql ?? pgExecutor)(opts.timescaleUrl);
    hist = new TimescaleHistorian(sql);
    await hist.init();
    stops.push(async () => {
      await hist?.flush();
      await close();
    });
  }

  let transport: MqttTransport | undefined;
  if (opts.mqttUrl) {
    transport = await (deps?.makeMqtt ?? mqttTransport)(opts.mqttUrl);
    const birth: SpPayload = {
      timestamp: Date.now(),
      seq: 0,
      metrics: rt.recordedTags().map((t, i) => ({ name: t, alias: i, value: rt.value(t) })),
    };
    await transport.publish(`${ns}/${group}/NBIRTH/${edge}`, jsonCodec.encode(birth));
    stops.push(() => transport!.end());
  }

  let seq = 1;
  const timer = setInterval(() => {
    const tags = rt.recordedTags();
    if (hist) {
      const ts = new Date().toISOString();
      hist.write(tags.map((t) => ({ tagId: t, value: rt.value(t), quality: 'Good', ts })));
      void hist.flush();
    }
    if (transport) {
      const payload: SpPayload = { timestamp: Date.now(), seq: seq++ % 256, metrics: tags.map((t, i) => ({ alias: i, value: rt.value(t) })) };
      void transport.publish(`${ns}/${group}/NDATA/${edge}`, jsonCodec.encode(payload));
    }
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  return async () => {
    clearInterval(timer);
    for (const s of stops) {
      try {
        await s();
      } catch {
        /* teardown best-effort */
      }
    }
  };
}
