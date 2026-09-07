import { describe, expect, it } from 'vitest';
import {
  NUM_ALL_KINDS,
  chineseNameOf,
  cornerLabelOf,
  glyphOf,
  isDragon,
  isWind,
  ownFlowersForSeat,
  parseTiles,
  tileFromString,
  tileToString,
} from '../tiles.js';
import { buildTileSet } from '../wall.js';

describe('tile set', () => {
  it('is 144 tiles with flowers', () => {
    const tiles = buildTileSet(true);
    expect(tiles).toHaveLength(144);
    // 108 number tiles + 28 honors + 8 flowers.
    expect(tiles.filter((t) => t < 27)).toHaveLength(108);
    expect(tiles.filter((t) => t >= 27 && t < 34)).toHaveLength(28);
    expect(tiles.filter((t) => t >= 34)).toHaveLength(8);
  });

  it('is 136 tiles without flowers', () => {
    expect(buildTileSet(false)).toHaveLength(136);
  });

  it('has twelve dragons, four of each', () => {
    const dragons = buildTileSet(true).filter(isDragon);
    expect(dragons).toHaveLength(12);
    expect(new Set(dragons).size).toBe(3);
  });

  it('has sixteen winds, four of each', () => {
    const winds = buildTileSet(true).filter(isWind);
    expect(winds).toHaveLength(16);
    expect(new Set(winds).size).toBe(4);
  });
});

describe('labels', () => {
  it('gives every kind a unique corner label', () => {
    const labels = new Set<string>();
    for (let t = 0; t < NUM_ALL_KINDS; t++) labels.add(cornerLabelOf(t));
    expect(labels.size).toBe(NUM_ALL_KINDS);
  });

  it('labels suited tiles with rank and suit letter', () => {
    expect(cornerLabelOf(tileFromString('1m'))).toBe('1m');
    expect(cornerLabelOf(tileFromString('9s'))).toBe('9s');
    expect(cornerLabelOf(tileFromString('5p'))).toBe('5p');
  });

  it('labels winds with their initials', () => {
    expect(['E', 'S', 'W', 'N'].map(tileFromString).map(cornerLabelOf)).toEqual([
      'E',
      'S',
      'W',
      'N',
    ]);
  });

  it('labels the white dragon Wh so it does not collide with West', () => {
    expect(cornerLabelOf(tileFromString('R'))).toBe('R');
    expect(cornerLabelOf(tileFromString('G'))).toBe('G');
    expect(cornerLabelOf(tileFromString('Wh'))).toBe('Wh');
    expect(tileFromString('Wh')).not.toBe(tileFromString('W'));
  });

  it('keeps Chinese names aligned with the labels', () => {
    expect(chineseNameOf(tileFromString('1m'))).toBe('一萬');
    expect(chineseNameOf(tileFromString('R'))).toBe('紅中');
    expect(chineseNameOf(tileFromString('G'))).toBe('青發');
    expect(chineseNameOf(tileFromString('Wh'))).toBe('白板');
    expect(chineseNameOf(tileFromString('E'))).toBe('東');
  });

  it('produces a distinct glyph for every kind', () => {
    const glyphs = new Set<string>();
    for (let t = 0; t < NUM_ALL_KINDS; t++) glyphs.add(glyphOf(t));
    expect(glyphs.size).toBe(NUM_ALL_KINDS);
  });
});

describe('parsing', () => {
  it('expands digit runs', () => {
    expect(parseTiles('123m')).toEqual([
      tileFromString('1m'),
      tileFromString('2m'),
      tileFromString('3m'),
    ]);
  });

  it('expands repeated honors', () => {
    expect(parseTiles('EEE')).toEqual([
      tileFromString('E'),
      tileFromString('E'),
      tileFromString('E'),
    ]);
  });

  it('reads Wh as the white dragon rather than West followed by junk', () => {
    expect(parseTiles('WhWh')).toEqual([tileFromString('Wh'), tileFromString('Wh')]);
    expect(parseTiles('WW')).toEqual([tileFromString('W'), tileFromString('W')]);
  });

  it('round-trips through tileToString', () => {
    for (let t = 0; t < NUM_ALL_KINDS; t++) {
      expect(tileFromString(tileToString(t))).toBe(t);
    }
  });
});

describe('own flowers', () => {
  it('pairs each seat with its season and plant', () => {
    expect(ownFlowersForSeat(0).map(cornerLabelOf)).toEqual(['Sp', 'Pl']);
    expect(ownFlowersForSeat(1).map(cornerLabelOf)).toEqual(['Su', 'Or']);
    expect(ownFlowersForSeat(2).map(cornerLabelOf)).toEqual(['Au', 'Ch']);
    expect(ownFlowersForSeat(3).map(cornerLabelOf)).toEqual(['Wi', 'Ba']);
  });
});
