import { describe, it, expect } from 'vitest';
import { boilerAlarms } from '../src/alarms/boiler-alarms';
import { thermalAlarmRationalization, buildAlarmRationalization } from '../src/alarms/rationalization';

describe('Alarm rationalization (ISA-18.2 / EEMUA-191)', () => {
  it('MỌI alarm có bản ghi rationalization (độ phủ 100%, không thiếu)', () => {
    const alarmIds = new Set(boilerAlarms.map((a) => a.alarmId));
    const ratIds = new Set(thermalAlarmRationalization.map((r) => r.alarmId));
    // mọi alarm có rationalization
    for (const id of alarmIds) expect(ratIds.has(id), `alarm ${id} phải có rationalization`).toBe(true);
    // không có rationalization mồ côi (trỏ alarm không tồn tại)
    for (const id of ratIds) expect(alarmIds.has(id), `rationalization ${id} phải khớp alarm`).toBe(true);
  });

  it('mỗi bản ghi có nguyên nhân + căn cứ ưu tiên + thời gian phản ứng hợp lệ, đã duyệt', () => {
    for (const r of thermalAlarmRationalization) {
      expect(r.cause.vi.length).toBeGreaterThan(0);
      expect(r.cause.en.length).toBeGreaterThan(0);
      expect(r.priorityBasis.vi.length).toBeGreaterThan(0);
      expect(r.responseTimeSec).toBeGreaterThan(0);
      expect(r.responseTimeSec).toBeLessThanOrEqual(1800);
      expect(r.reviewed).toBe(true);
    }
  });

  it('thời gian phản ứng nhất quán với ưu tiên: P1 nhanh hơn P3', () => {
    const byId = new Map(thermalAlarmRationalization.map((r) => [r.alarmId, r]));
    const p1 = boilerAlarms.filter((a) => a.priority === 'P1').map((a) => byId.get(a.alarmId)!.responseTimeSec);
    const p3 = boilerAlarms.filter((a) => a.priority === 'P3').map((a) => byId.get(a.alarmId)!.responseTimeSec);
    const maxP1 = Math.max(...p1);
    const minP3 = Math.min(...p3);
    expect(maxP1).toBeLessThanOrEqual(minP3); // P1 phản ứng gấp hơn P3
  });

  it('buildAlarmRationalization: báo cáo master + độ phủ + phân bố ưu tiên', () => {
    const rep = buildAlarmRationalization(boilerAlarms);
    expect(rep.total).toBe(boilerAlarms.length);
    expect(rep.rationalized).toBe(boilerAlarms.length);
    expect(rep.coveragePct).toBe(100);
    expect(rep.reviewed).toBe(boilerAlarms.length);
    expect(rep.unrationalized).toHaveLength(0);
    expect(rep.master).toHaveLength(boilerAlarms.length);
    // tổng phân bố = tổng alarm
    const sum = rep.distribution.P1 + rep.distribution.P2 + rep.distribution.P3 + rep.distribution.P4;
    expect(sum).toBe(boilerAlarms.length);
    // subset an toàn nặng P1 → phân bố KHÔNG đạt EEMUA (P1 share > ngưỡng) — phát hiện trung thực.
    expect(rep.distributionPct.P1).toBeGreaterThan(10);
    expect(rep.distributionOk).toBe(false);
    // mục tiêu EEMUA hiển thị đúng
    expect(rep.eemuaTarget.P3).toBe(80);
  });

  it('phát hiện alarm CHƯA rationalize khi thiếu bản ghi', () => {
    const partial = thermalAlarmRationalization.filter((r) => r.alarmId !== 'FIRE-DETECTED');
    const rep = buildAlarmRationalization(boilerAlarms, partial);
    expect(rep.unrationalized).toContain('FIRE-DETECTED');
    expect(rep.coveragePct).toBeLessThan(100);
  });
});
