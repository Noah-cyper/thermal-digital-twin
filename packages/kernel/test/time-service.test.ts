import { describe, it, expect } from 'vitest';
import { TimeService } from '../src/time-service';

describe('TimeService (kernel L1) — nguồn thời gian duy nhất', () => {
  it('formatEpoch tất định theo offset (+07:00 mặc định)', () => {
    const t = new TimeService();
    expect(t.formatEpoch(0)).toBe('1970-01-01T07:00:00+07:00'); // epoch 0 UTC + 7h
    expect(t.offset()).toBe('+07:00');
  });

  it('offset tuỳ biến; formatEpoch phản ánh đúng', () => {
    const t = new TimeService({ offset: '-05:00' });
    expect(t.offset()).toBe('-05:00');
    expect(t.formatEpoch(0)).toBe('1969-12-31T19:00:00-05:00'); // epoch 0 − 5h
  });

  it('offset không hợp lệ → throw', () => {
    expect(() => new TimeService({ offset: 'bad' })).toThrow(/offset không hợp lệ/);
  });

  it('now trả ISO có offset; monotonicMs là số không âm', () => {
    const t = new TimeService();
    expect(t.now()).toMatch(/T\d{2}:\d{2}:\d{2}\+07:00$/);
    expect(t.monotonicMs()).toBeGreaterThanOrEqual(0);
  });

  it('replayClock: seek đặt mốc; setSpeed clamp [0,25 .. 60]; at() trả ISO hợp lệ', () => {
    const t = new TimeService();
    const rc = t.replayClock();
    rc.seek('2020-06-15T08:00:00+07:00');
    expect(rc.at()).toMatch(/^2020-06-15T08:00:0/); // ~mốc vừa seek (elapsed ~0)
    rc.setSpeed(1000); // > max → clamp 60
    rc.setSpeed(0.001); // < min → clamp 0,25
    expect(rc.at()).toMatch(/T\d{2}:\d{2}:\d{2}\+07:00$/);
    const rc2 = t.replayClock('2019-01-01T00:00:00+07:00');
    expect(rc2.at()).toMatch(/^2019-01-01T00:00:0/);
  });
});
