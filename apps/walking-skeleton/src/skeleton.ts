// Walking skeleton (Pha A W4) — composition root: nối Sim (plugin DrumModel) → Control PID →
// Tag/Realtime thành vòng kín drum level 3-element. Đây là app tổ hợp (được phép import cả
// engines lẫn plugin); plugin runtime vẫn chỉ import @idtp/sdk.
import { SimulationHost, TagRealtimeEngine, PidController } from '@idtp/engines';
import { DrumModel } from '@idtp/plugin-thermal-power-600';
import type { Quality } from '@idtp/sdk';

const TS = '2026-07-24T10:00:00+07:00';
const FW_MAX_TPH = 2100;
const GOOD: Quality = 'Good';

export interface Skeleton {
  step(): void;
  level(): number;
  fwCv(): number;
  fwFlow(): number;
  setSteamDemand(tph: number): void;
  injectTubeLeak(rateTph: number): void;
  tag: TagRealtimeEngine;
}

export function createSkeleton(): Skeleton {
  const tag = new TagRealtimeEngine();
  const num = (id: string, def = 0): number => {
    const v = tag.getCurrent(id);
    return typeof v?.value === 'number' ? v.value : def;
  };

  // seed đầu vào cân bằng ở tải 1500 t/h, mức 0
  tag.ingest([
    { tagId: 'BLR_STEAM_DEMAND', value: 1500, quality: GOOD, ts: TS },
    { tagId: 'BLR_FW_CV_01', value: (1500 / FW_MAX_TPH) * 100, quality: GOOD, ts: TS },
  ]);

  const host = new SimulationHost(100, {
    now: () => TS,
    getTag: (id) => num(id),
    onOutputs: (outs) =>
      tag.ingest(outs.map((o) => ({ tagId: o.tagId, value: o.value, quality: o.quality, ts: TS }))),
  });
  const drum = new DrumModel();
  host.register(drum);

  // Level PID 3-element: SP mức = 0 mm, feedforward = steam flow (doc 09/10).
  const pid = new PidController({ kp: 0.006, ki: 0.002, kd: 0, outLo: 0, outHi: 100 });
  pid.setMode('AUTO');

  const step = (): void => {
    host.step();
    const level = num('BLR_DRUM_LEVEL_01');
    const steam = num('BLR_STEAM_FLOW_01', 1500);
    const ff = (steam / FW_MAX_TPH) * 100;
    const cv = pid.step(level, 0, 0.1, ff);
    tag.ingest([{ tagId: 'BLR_FW_CV_01', value: cv, quality: GOOD, ts: TS }]);
  };

  return {
    step,
    tag,
    level: () => num('BLR_DRUM_LEVEL_01'),
    fwCv: () => num('BLR_FW_CV_01'),
    fwFlow: () => num('BLR_FW_FLOW_01'),
    setSteamDemand: (tph) => tag.ingest([{ tagId: 'BLR_STEAM_DEMAND', value: tph, quality: GOOD, ts: TS }]),
    injectTubeLeak: (rateTph) => host.inject(drum.id, { id: 'tube-leak', params: { rate: rateTph } }),
  };
}
