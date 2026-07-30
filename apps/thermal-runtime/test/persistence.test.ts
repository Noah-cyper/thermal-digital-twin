import { describe, it, expect } from 'vitest';
import { startPersistence } from '../src/persistence';
import type { SqlExecutor, MqttTransport } from '@idtp/engines';

// Runtime giả: 2 tag giá trị cố định.
const rt = { recordedTags: () => ['GEN_MW_01', 'BLR_STEAM_FLOW_01'], value: (t: string) => (t === 'GEN_MW_01' ? 448 : 1500) };

describe('persistence bridge (deploy §5) — wiring với adapter GIẢ (không cần pg/mqtt)', () => {
  it('Timescale: DDL init + batch INSERT theo chu kỳ; Sparkplug: NBIRTH rồi NDATA', async () => {
    const sqlLog: string[] = [];
    const topics: string[] = [];
    const fakeSql: SqlExecutor = { exec: async (q) => { sqlLog.push(q); return { rows: [] }; } };
    const fakeMqtt: MqttTransport = {
      connected: true,
      publish: async (topic) => { topics.push(topic); },
      subscribe: async () => {},
      end: async () => {},
    };

    const stop = await startPersistence(
      rt,
      { timescaleUrl: 'x', mqttUrl: 'y', intervalMs: 20 },
      { makeSql: async () => ({ sql: fakeSql, close: async () => {} }), makeMqtt: async () => fakeMqtt },
    );

    // init() đã chạy DDL (bảng + hypertable); NBIRTH publish ngay khi bật.
    expect(sqlLog.some((q) => /create_hypertable/i.test(q))).toBe(true);
    expect(topics.some((t) => /\/NBIRTH\//.test(t))).toBe(true);

    await new Promise((r) => setTimeout(r, 70)); // vài chu kỳ 20 ms

    // Ghi bền bằng INSERT nhiều dòng + publish NDATA định kỳ.
    expect(sqlLog.some((q) => /INSERT INTO/i.test(q))).toBe(true);
    expect(topics.some((t) => /\/NDATA\//.test(t))).toBe(true);

    await stop();
  });

  it('không cấu hình gì → không chạm adapter (không gọi makeSql/makeMqtt)', async () => {
    let touched = false;
    const stop = await startPersistence(
      rt,
      {},
      { makeSql: async () => { touched = true; throw new Error('x'); }, makeMqtt: async () => { touched = true; throw new Error('x'); } },
    );
    expect(touched).toBe(false);
    await stop();
  });
});
