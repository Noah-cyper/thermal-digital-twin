import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — SFC chạy live (tick theo nhịp sim, tác động tag sim)', () => {
  it('mill-a-stop live → tới done, đặt BLR_MILL_A_STOP_CMD=1; mill-a-start → xoá về 0', () => {
    const rt = createThermalRuntime({ warmupSteps: 0 });

    expect(rt.startLiveSequence('mill-a-stop').status).toBe('running');
    for (let i = 0; i < 60 && rt.liveSequenceState().length > 0; i++) rt.step();
    expect(rt.liveSequenceState().length).toBe(0); // chuỗi đã kết thúc
    expect(rt.value('BLR_MILL_A_STOP_CMD')).toBe(1); // SFC đã ghi tag sim đọc

    rt.startLiveSequence('mill-a-start');
    for (let i = 0; i < 60 && rt.liveSequenceState().length > 0; i++) rt.step();
    expect(rt.value('BLR_MILL_A_STOP_CMD')).toBe(0); // mill-a-start phục hồi mill A

    expect(rt.startLiveSequence('khong-co').status).toBe('failed');
  });
});
