import { describe, it, expect } from 'vitest';
import { startPersistence } from '../src/persistence';
import type { MqttTransport } from '@idtp/engines';

// Nhánh catch teardown (best-effort): stop() nuốt lỗi khi adapter end() ném → không văng ra ngoài.
const rt = { recordedTags: () => ['GEN_MW_01'], value: () => 448 };

describe('persistence teardown best-effort (deploy §5)', () => {
  it('stop() nuốt lỗi khi transport.end() ném (không reject)', async () => {
    const throwingMqtt: MqttTransport = {
      connected: true,
      publish: async () => {},
      subscribe: async () => {},
      end: async () => {
        throw new Error('broker mất kết nối khi đóng');
      },
    };
    const stop = await startPersistence(
      rt,
      { mqttUrl: 'y', intervalMs: 1000 },
      { makeMqtt: async () => throwingMqtt },
    );
    // end() ném nhưng stop() bắt best-effort → resolve bình thường.
    await expect(stop()).resolves.toBeUndefined();
  });
});
