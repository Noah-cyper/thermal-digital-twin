import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/event-bus';

describe('EventBus', () => {
  it('pub/sub và unsubscribe', () => {
    const bus = new EventBus();
    const got: number[] = [];
    const off = bus.subscribe<number>('sim.step', (n) => got.push(n));
    bus.publish('sim.step', 1);
    bus.publish('sim.step', 2);
    off();
    bus.publish('sim.step', 3);
    expect(got).toEqual([1, 2]);
  });

  it('cô lập lỗi handler', () => {
    const bus = new EventBus();
    const got: string[] = [];
    bus.subscribe<string>('tag.update', () => {
      throw new Error('handler lỗi');
    });
    bus.subscribe<string>('tag.update', (s) => got.push(s));
    expect(() => bus.publish('tag.update', 'ok')).not.toThrow();
    expect(got).toEqual(['ok']);
  });

  it('request/respond', async () => {
    const bus = new EventBus();
    bus.respond<number, number>('square', (n) => n * n);
    const res = await bus.request<number, number>('square', 7, 1000);
    expect(res).toBe(49);
  });

  it('request timeout khi không có responder', async () => {
    const bus = new EventBus();
    await expect(bus.request('nobody', {}, 30)).rejects.toThrow(/timeout/);
  });
});
