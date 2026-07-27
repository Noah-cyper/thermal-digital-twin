import { describe, it, expect } from 'vitest';
import { PluginLoader, PluginRejected, type PluginLoaderOptions } from '../src/plugin-loader';
import type { EngineName } from '@idtp/sdk';

const manifest = {
  plugin: {
    id: 'thermal-power-600',
    version: '1.0.0',
    engineApi: '^1.0.0',
    domain: 'power.thermal.coal',
    displayName: { vi: 'Nhiệt điện than 600 MW', en: 'Coal Thermal 600 MW' },
  },
  provides: { assetModel: 'model/isa95.yaml', tagRegistry: 'tags/**', graphics: 'screens/*', navigation: 'nav/tree.yaml', i18n: 'i18n/{vi,en}.json' },
  requires: { engines: ['tag', 'alarm', 'historian'], protocols: ['mqtt-sparkplug'], minTagCapacity: 15000 },
};

const allEngines: EngineName[] = ['tag', 'alarm', 'historian', 'graphics', 'sim', 'control', 'report'];

function loader(engineApi = '1.0.0'): PluginLoader {
  const opts: PluginLoaderOptions = {
    engineApi,
    availableEngines: new Set(allEngines),
    availableProtocols: new Set(['mqtt-sparkplug']),
  };
  return new PluginLoader(opts);
}

describe('PluginLoader', () => {
  it('validate + register + vòng đời', () => {
    const l = loader();
    expect(l.validate(manifest).ok).toBe(true);
    const lp = l.register(manifest);
    expect(lp.phase).toBe('Registered');
    expect(l.start('thermal-power-600').phase).toBe('Started');
    l.unload('thermal-power-600');
    expect(l.list()).toHaveLength(0);
  });

  it('loại khi engineApi không khớp', () => {
    const l = loader('2.0.0'); // ^1.0.0 không nhận 2.0.0
    const v = l.validate(manifest);
    expect(v.ok).toBe(false);
    expect(() => l.register(manifest)).toThrow(PluginRejected);
  });

  it('loại khi thiếu engine yêu cầu', () => {
    const l = loader();
    const m = { ...manifest, requires: { ...manifest.requires, engines: ['tag', 'unknownEngine'] } };
    // schema chỉ chấp enum engine → 'unknownEngine' bị Zod loại
    expect(l.validate(m).ok).toBe(false);
  });

  it('loại manifest sai schema', () => {
    const l = loader();
    expect(l.validate({ plugin: { id: 'X' } }).ok).toBe(false); // thiếu field
  });
});
