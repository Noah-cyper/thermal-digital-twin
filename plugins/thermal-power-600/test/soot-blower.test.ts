import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { SootBlowerModel } from '../src/sim/soot-blower';

// ctx với dtMs cấu hình được (mặc định 1 phút) → tua nhanh chu trình thổi (giờ) trong test tất định.
function ctxOf(tags: Record<string, number>, dtMs = 60_000): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: SootBlowerModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}
// Chạy tới khi điều kiện đúng (hoặc hết maxSteps) — trả bản đọc cuối.
function runUntil(m: SootBlowerModel, tags: Record<string, number>, pred: (o: Record<string, number>) => boolean, maxSteps = 2000): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < maxSteps; i++) {
    o = one(m, tags);
    if (pred(o)) break;
  }
  return o;
}

describe('SootBlowerModel (doc 10 §10 BOP) — thổi bụi bề mặt truyền nhiệt', () => {
  it('điểm vận hành: chỉ số bám tích tụ theo thời gian, độ sạch = 100 − bám, header hơi ~30 barg khi nghỉ', () => {
    const m = new SootBlowerModel();
    m.init();
    const o0 = one(m, { BLR_COAL_FLOW_01: 211 });
    // Sau 1 phút bám mới nhích lên trên mức khởi tạo 20 %.
    expect(o0.SB_FOULING_INDEX_01).toBeGreaterThan(20);
    expect(o0.SB_FOULING_INDEX_01).toBeLessThan(21);
    expect(o0.SB_CLEANLINESS_01).toBeCloseTo(100 - o0.SB_FOULING_INDEX_01, 6);
    expect(o0.SB_STEAM_HEADER_PRESS_01).toBe(30);
    expect(o0.SB_STEAM_FLOW_01).toBe(0); // nghỉ → không tiêu hơi
    expect(o0.SB_CYCLE_ACTIVE_01).toBe(0);
  });

  it('bám vượt ngưỡng → khởi động chu trình thổi: hơi thổi > 0, vùng quét 1..4, rồi hạ bám về mức dư', () => {
    const m = new SootBlowerModel();
    m.init();
    // Chạy tới khi chu trình kích hoạt (bám ≥ 45 %).
    const started = runUntil(m, { BLR_COAL_FLOW_01: 211 }, (o) => o.SB_CYCLE_ACTIVE_01 === 1);
    expect(started.SB_CYCLE_ACTIVE_01).toBe(1);
    expect(started.SB_ZONE_ACTIVE_01).toBeGreaterThanOrEqual(1);
    expect(started.SB_STEAM_FLOW_01).toBeGreaterThan(0);
    expect(started.SB_STEAM_HEADER_PRESS_01).toBeLessThan(30); // sụt áp khi đang thổi
    // Chạy tới khi chu trình hoàn tất → về nghỉ, bám hạ mạnh, mọi máy thổi đã stroke.
    const done = runUntil(m, { BLR_COAL_FLOW_01: 211 }, (o) => o.SB_CYCLE_ACTIVE_01 === 0);
    expect(done.SB_CYCLE_ACTIVE_01).toBe(0);
    expect(done.SB_FOULING_INDEX_01).toBeLessThan(20); // đã làm sạch dưới điểm khởi động chu trình
    expect(done.SB_TIME_SINCE_CYCLE_01).toBe(0); // đồng hồ kể từ chu trình vừa reset
    expect(done.SB_BLOWERS_STROKED_01).toBe(SootBlowerModel.totalBlowers); // 50 máy thổi đã quét đủ
  });

  it('dừng đốt (than = 0): không tích bám thêm, không khởi động chu trình', () => {
    const m = new SootBlowerModel();
    m.init();
    const o = one(m, { BLR_COAL_FLOW_01: 0 });
    expect(o.SB_FOULING_INDEX_01).toBeCloseTo(20, 6); // không nhích
    for (let i = 0; i < 1000; i++) one(m, { BLR_COAL_FLOW_01: 0 });
    const o2 = one(m, { BLR_COAL_FLOW_01: 0 });
    expect(o2.SB_CYCLE_ACTIVE_01).toBe(0); // bám không tăng → không bao giờ chạm ngưỡng
  });

  it('malfunction sootblower-fault: chu trình vẫn quét nhưng KHÔNG làm sạch → bám leo thang', () => {
    const m = new SootBlowerModel();
    m.init();
    m.injectMalfunction({ id: 'sootblower-fault' });
    // Chạy dài: chu trình có thể kích hoạt nhưng bám không hạ → vượt cao.
    const o = runUntil(m, { BLR_COAL_FLOW_01: 211 }, (o) => o.SB_FOULING_INDEX_01 > 60, 5000);
    expect(o.SB_FOULING_INDEX_01).toBeGreaterThan(60);
    m.clearMalfunction('sootblower-fault');
    // Sau khi gỡ lỗi, một chu trình thổi hạ được bám.
    const cleaned = runUntil(m, { BLR_COAL_FLOW_01: 211 }, (o) => o.SB_FOULING_INDEX_01 < 20, 5000);
    expect(cleaned.SB_FOULING_INDEX_01).toBeLessThan(20);
  });

  it('snapshot/restore giữ tiến trình chu trình (OTS)', () => {
    const m = new SootBlowerModel();
    m.init();
    runUntil(m, { BLR_COAL_FLOW_01: 211 }, (o) => o.SB_CYCLE_ACTIVE_01 === 1);
    const snap = m.snapshot();
    const m2 = new SootBlowerModel();
    m2.init();
    m2.restore(snap);
    const s2 = m2.snapshot();
    expect(s2.state.fouling).toBeCloseTo(snap.state.fouling as number, 6);
    expect(s2.state.zone).toBe(snap.state.zone);
    expect(s2.state.blowing).toBe(snap.state.blowing);
    expect(s2.state.blowersStroked).toBe(snap.state.blowersStroked);
  });
});
