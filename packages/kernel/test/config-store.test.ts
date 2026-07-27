import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ConfigStore } from '../src/config-store';

describe('ConfigStore', () => {
  it('get/set + watch hot-reload', () => {
    const cfg = new ConfigStore();
    const seen: number[] = [];
    cfg.watch<number>('dtMs', (v) => seen.push(v));
    cfg.set('dtMs', 100);
    expect(cfg.get<number>('dtMs')).toBe(100);
    expect(seen).toEqual([100]);
  });

  it('validate schema theo key', () => {
    const cfg = new ConfigStore();
    cfg.registerSchema('scan', z.number().int().positive());
    expect(cfg.set('scan', 250).ok).toBe(true);
    const bad = cfg.set('scan', -1);
    expect(bad.ok).toBe(false);
  });

  it('namespace theo plugin cách ly key', () => {
    const root = new ConfigStore();
    const a = root.namespace('thermal-power-600');
    const b = root.namespace('water-treatment-demo');
    a.set('root', 'A');
    b.set('root', 'B');
    expect(a.get<string>('root')).toBe('A');
    expect(b.get<string>('root')).toBe('B');
  });
});
