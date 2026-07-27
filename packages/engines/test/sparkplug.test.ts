import { describe, it, expect } from 'vitest';
import type { TagValue } from '@idtp/sdk';
import type { MqttTransport, SpPayload } from '../src/sparkplug';
import { SparkplugDriver, jsonCodec } from '../src/sparkplug';

class FakeMqtt implements MqttTransport {
  connected = true;
  published: { topic: string; payload: Uint8Array }[] = [];
  filter = '';
  private handler: ((t: string, p: Uint8Array) => void) | null = null;
  async publish(topic: string, payload: Uint8Array): Promise<void> {
    this.published.push({ topic, payload });
  }
  async subscribe(filter: string, handler: (t: string, p: Uint8Array) => void): Promise<void> {
    this.filter = filter;
    this.handler = handler;
  }
  async end(): Promise<void> {
    this.connected = false;
  }
  feed(topic: string, p: SpPayload): void {
    this.handler?.(topic, jsonCodec.encode(p));
  }
}

const cfg = {
  group: 'HOANTRAN',
  edgeNode: 'IDTP-HOST',
  metricMap: { drum_level: 'BLR_DRUM_LEVEL_01', ms_press: 'BLR_MSTM_SH_PRESS_01' },
};

function mkCtx(): { published: TagValue[][]; ctx: { publish(v: ReadonlyArray<TagValue>): void; logAudit(): void } } {
  const published: TagValue[][] = [];
  return { published, ctx: { publish: (v) => published.push([...v]), logAudit: () => {} } };
}

describe('SparkplugDriver (doc 16) — host Sparkplug B, transport inject', () => {
  it('connect: subscribe topic group; isConnected', async () => {
    const mq = new FakeMqtt();
    const d = new SparkplugDriver(mq);
    const { ctx } = mkCtx();
    await d.connect(ctx, cfg);
    expect(mq.filter).toBe('spBv1.0/HOANTRAN/#');
    expect(d.isConnected).toBe(true);
  });

  it('NBIRTH lập alias + đẩy giá trị; NDATA (chỉ alias) giải đúng tag', async () => {
    const mq = new FakeMqtt();
    const d = new SparkplugDriver(mq);
    const { published, ctx } = mkCtx();
    await d.connect(ctx, cfg);

    mq.feed('spBv1.0/HOANTRAN/NBIRTH/EDGE1', {
      timestamp: 1000, seq: 0,
      metrics: [{ name: 'drum_level', alias: 1, value: 0.5 }, { name: 'ms_press', alias: 2, value: 17.5 }],
    });
    const birth = published.at(-1) ?? [];
    expect(birth.find((v) => v.tagId === 'BLR_DRUM_LEVEL_01')?.value).toBe(0.5);
    expect(birth.find((v) => v.tagId === 'BLR_MSTM_SH_PRESS_01')?.value).toBe(17.5);

    mq.feed('spBv1.0/HOANTRAN/NDATA/EDGE1', { timestamp: 2000, seq: 1, metrics: [{ alias: 2, value: 18.1 }] });
    const data = published.at(-1) ?? [];
    expect(data).toHaveLength(1);
    expect(data[0]?.tagId).toBe('BLR_MSTM_SH_PRESS_01'); // alias 2 → ms_press → tag
    expect(data[0]?.value).toBe(18.1);
  });

  it('write → phát NCMD với metric name + value', async () => {
    const mq = new FakeMqtt();
    const d = new SparkplugDriver(mq);
    const { ctx } = mkCtx();
    await d.connect(ctx, cfg);
    const res = await d.write({ tagId: 'BLR_MSTM_SH_PRESS_01', value: 17, user: 'op', reason: 'test' });
    expect(res.ok).toBe(true);
    const ncmd = mq.published.at(-1);
    expect(ncmd?.topic).toBe('spBv1.0/HOANTRAN/NCMD/IDTP-HOST');
    const p = jsonCodec.decode(ncmd?.payload ?? new Uint8Array());
    expect(p.metrics[0]?.name).toBe('ms_press');
    expect(p.metrics[0]?.value).toBe(17);
    // tag không ánh xạ → chặn
    expect((await d.write({ tagId: 'UNKNOWN', value: 1, user: 'op', reason: 'x' })).ok).toBe(false);
  });

  it('subscribe(tagIds) lọc: chỉ đẩy tag quan tâm', async () => {
    const mq = new FakeMqtt();
    const d = new SparkplugDriver(mq);
    const { published, ctx } = mkCtx();
    await d.connect(ctx, cfg);
    mq.feed('spBv1.0/HOANTRAN/NBIRTH/EDGE1', {
      timestamp: 1, seq: 0,
      metrics: [{ name: 'drum_level', alias: 1, value: 0 }, { name: 'ms_press', alias: 2, value: 17.5 }],
    });
    await d.subscribe(['BLR_DRUM_LEVEL_01']);
    mq.feed('spBv1.0/HOANTRAN/NDATA/EDGE1', { timestamp: 2, seq: 1, metrics: [{ alias: 1, value: 5 }, { alias: 2, value: 18 }] });
    const data = published.at(-1) ?? [];
    expect(data).toHaveLength(1);
    expect(data[0]?.tagId).toBe('BLR_DRUM_LEVEL_01');
  });
});
