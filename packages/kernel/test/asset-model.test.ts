import { describe, it, expect } from 'vitest';
import { AssetModel, type AssetNode } from '../src/asset-model';

const tree: AssetNode[] = [
  { assetId: 'UNIT1', level: 'Area', name: 'UNIT1' },
  { assetId: 'BOILER_ISLAND', level: 'Cell', name: 'BOILER_ISLAND', parentId: 'UNIT1' },
  { assetId: 'STEAM_DRUM', level: 'Unit', name: 'STEAM_DRUM', parentId: 'BOILER_ISLAND' },
  { assetId: 'LT-001', level: 'ControlModule', name: 'LT-001', parentId: 'STEAM_DRUM', equipmentModule: 'DRUM_LEVEL_CONTROL' },
];

describe('AssetModel', () => {
  it('dựng cây + path + children + tagsOf', () => {
    const am = new AssetModel();
    expect(am.load(tree, 'thermal-power-600').ok).toBe(true);
    am.linkTag('LT-001', 'uuid-drum-1');

    expect(am.path('LT-001').map((n) => n.assetId)).toEqual(['UNIT1', 'BOILER_ISLAND', 'STEAM_DRUM', 'LT-001']);
    expect(am.children('BOILER_ISLAND').map((n) => n.assetId)).toEqual(['STEAM_DRUM']);
    expect(am.tagsOf('LT-001')).toEqual(['uuid-drum-1']);
    expect(am.get('LT-001')?.equipmentModule).toBe('DRUM_LEVEL_CONTROL');
  });

  it('loại node mồ côi', () => {
    const am = new AssetModel();
    const r = am.load([{ assetId: 'X', level: 'Unit', name: 'X', parentId: 'MISSING' }], 'p');
    expect(r.ok).toBe(false);
  });
});
