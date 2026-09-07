import { describe, expect, it } from 'vitest';
import {
  MELDS_REQUIRED,
  completesHand,
  enumerateDecompositions,
  isWinningShape,
  shanten,
  shantenReference,
  waits,
} from '../hand.js';
import { buildTileSet, mulberry32, shuffle } from '../wall.js';
import {
  countsFromTiles,
  parseTiles,
  tileFromString,
  totalCount,
  type Counts,
} from '../tiles.js';
import { bruteShanten } from './brute.js';

function counts(spec: string): Counts {
  return countsFromTiles(parseTiles(spec));
}

describe('winning shape', () => {
  it('accepts five runs plus a pair', () => {
    const c = counts('123m 456m 789m 234p 567p 55s');
    expect(totalCount(c)).toBe(17);
    expect(isWinningShape(c, MELDS_REQUIRED)).toBe(true);
  });

  it('accepts five triplets plus a pair', () => {
    const c = counts('111m 222m 333p EEE RRR 55s');
    expect(isWinningShape(c, MELDS_REQUIRED)).toBe(true);
  });

  it('rejects a 14-tile hand, which would win in other variants', () => {
    const c = counts('123m 456m 789m 234p 55s');
    expect(totalCount(c)).toBe(14);
    expect(isWinningShape(c, MELDS_REQUIRED)).toBe(false);
  });

  it('rejects five sets with no pair', () => {
    const c = counts('123m 456m 789m 234p 567p 9s');
    expect(isWinningShape(c, MELDS_REQUIRED)).toBe(false);
  });

  it('rejects runs that wrap across suits', () => {
    // 8m 9m 1p is not a run.
    const c = counts('89m 1p 123m 456m 789p 234s 55s');
    expect(isWinningShape(c, MELDS_REQUIRED)).toBe(false);
  });

  it('honours already-melded sets by lowering the requirement', () => {
    // Two sets on the table, so the concealed portion needs three plus a pair.
    const c = counts('123m 456m 789m 55s');
    expect(totalCount(c)).toBe(11);
    expect(isWinningShape(c, MELDS_REQUIRED - 2)).toBe(true);
    expect(isWinningShape(c, MELDS_REQUIRED)).toBe(false);
  });
});

describe('decompositions', () => {
  it('finds both readings of a triple run', () => {
    const c = counts('111222333m 456p 789p 55s');
    const decs = enumerateDecompositions(c, MELDS_REQUIRED);
    const shapes = decs.map((d) => `${d.pungs.length}p/${d.chows.length}c`);
    expect(shapes).toContain('3p/2c');
    expect(shapes).toContain('0p/5c');
  });

  it('returns nothing for an incomplete hand', () => {
    expect(enumerateDecompositions(counts('123m'), MELDS_REQUIRED)).toEqual([]);
  });
});

describe('waits', () => {
  it('finds a two-sided wait', () => {
    // 111p is inert, so 56p waits on exactly 4p and 7p.
    const c = counts('123m 456m 789m 111p 56p 55s');
    expect(totalCount(c)).toBe(16);
    expect(waits(c, 0)).toEqual([tileFromString('4p'), tileFromString('7p')]);
  });

  it('finds the third wait hiding in an adjacent run', () => {
    // 234p + 56p looks like a plain 4p/7p wait, but 1p also completes the hand
    // by re-reading the block as 123p + 456p.
    const c = counts('123m 456m 789m 234p 56p 55s');
    expect(waits(c, 0)).toEqual([
      tileFromString('1p'),
      tileFromString('4p'),
      tileFromString('7p'),
    ]);
  });

  it('finds a closed wait', () => {
    const c = counts('123m 456m 789m 234p 57p 55s');
    expect(waits(c, 0)).toEqual([tileFromString('6p')]);
  });

  it('finds an edge wait', () => {
    const c = counts('123m 456m 789m 234p 12p 55s');
    expect(waits(c, 0)).toEqual([tileFromString('3p')]);
  });

  it('finds a lone pair wait', () => {
    const c = counts('123m 456m 789m 234p 567p 5s');
    expect(waits(c, 0)).toEqual([tileFromString('5s')]);
  });

  it('finds a dual pair wait', () => {
    const c = counts('123m 456m 789m 234p 55p 66s');
    expect(waits(c, 0)).toEqual([tileFromString('5p'), tileFromString('6s')]);
  });

  it('accounts for sets already on the table', () => {
    // Three sets melded, so eleven tiles minus one remain concealed.
    const c = counts('123m 456m 56p');
    expect(totalCount(c)).toBe(8);
    expect(waits(c, 3)).toEqual([]);
    const c2 = counts('123m 456m 5p');
    expect(totalCount(c2)).toBe(7);
    expect(waits(c2, 3)).toEqual([tileFromString('5p')]);
  });

  it('agrees with completesHand', () => {
    const c = counts('123m 456m 789m 234p 56p 55s');
    for (const t of waits(c, 0)) {
      expect(completesHand(c, 0, t)).toBe(true);
    }
    expect(completesHand(c, 0, tileFromString('9s'))).toBe(false);
  });
});

describe('shanten', () => {
  it('reports -1 for a completed hand', () => {
    expect(shanten(counts('123m 456m 789m 234p 567p 55s'), 0)).toBe(-1);
  });

  it('reports 0 for a hand waiting on a tile', () => {
    expect(shanten(counts('123m 456m 789m 234p 56p 55s'), 0)).toBe(0);
  });

  it('reports 0 for a four-set two-pair shape', () => {
    expect(shanten(counts('123m 456m 789m 234p 55p 66s'), 0)).toBe(0);
  });

  it('needs an extra tile when nothing can serve as the pair', () => {
    // Four triplets and two half-runs, with no pair anywhere.
    const c = counts('111m 222m 333m 444m 56p 78s');
    expect(totalCount(c)).toBe(16);
    expect(shanten(c, 0)).toBe(1);
  });

  it('counts melded sets as complete', () => {
    // One set on the table plus four concealed sets and a lone tile.
    const c = counts('123m 456m 789m 234p 5s');
    expect(totalCount(c)).toBe(13);
    expect(shanten(c, 1)).toBe(0);
  });

  it('matches the brute-force oracle on random hands', () => {
    const rng = mulberry32(20260907);
    const deck = buildTileSet(false);
    for (let trial = 0; trial < 60; trial++) {
      const hand = shuffle(deck, rng).slice(0, 16).sort((a, b) => a - b);
      const c = countsFromTiles(hand);
      const fast = shanten(c, 0);
      // Bounding the oracle just above the value under test keeps it quick and
      // still fails if `fast` is too high or too low.
      expect(fast, `hand ${hand.join(',')}`).toBe(bruteShanten(c, [], fast + 2));
    }
  });

  it('matches the oracle on hands drawn toward a target shape', () => {
    // Random 16-tile hands cluster around 4-5 shanten, so build some hands
    // that are close to complete to cover the other end of the range.
    const rng = mulberry32(777);
    const deck = buildTileSet(false);
    for (let trial = 0; trial < 40; trial++) {
      const shuffled = shuffle(deck, rng);
      // Take a real winning-ish core, then corrupt a few tiles.
      const core = parseTiles('123m 456m 789m 234p 567p 55s');
      const keep = 17 - (1 + (trial % 5));
      const hand = [...core.slice(0, keep), ...shuffled.slice(0, 16 - keep)].sort(
        (a, b) => a - b,
      );
      const c = countsFromTiles(hand);
      if (totalCount(c) !== 16) continue;
      let legal = true;
      for (let t = 0; t < 34; t++) if ((c[t] ?? 0) > 4) legal = false;
      if (!legal) continue;
      const fast = shanten(c, 0);
      expect(fast, `hand ${hand.join(',')}`).toBe(bruteShanten(c, [], fast + 2));
    }
  });

  it('matches the oracle when sets are already melded', () => {
    const rng = mulberry32(31337);
    const deck = buildTileSet(false);
    for (let trial = 0; trial < 20; trial++) {
      const shuffled = shuffle(deck, rng);
      const meld = [0, 1, 2]; // 123m on the table
      const rest = shuffled.filter((t) => t > 2).slice(0, 13);
      const c = countsFromTiles(rest);
      if (totalCount(c) !== 13) continue;
      const fast = shanten(c, 1);
      expect(fast, `hand ${rest.sort((a, b) => a - b).join(',')}`).toBe(
        bruteShanten(c, [meld], fast + 2),
      );
    }
  });

  it('never reports a value below -1', () => {
    const c = counts('111m 111p 111s EEE RRR GG');
    expect(shanten(c, 0)).toBeGreaterThanOrEqual(-1);
  });

  it('matches the whole-hand reference search exactly', () => {
    // The fast version carves each suit up separately and combines the
    // results; this pins it to the slow but obviously-correct search over a
    // wide spread of hands and meld counts.
    const rng = mulberry32(4242);
    const deck = buildTileSet(false);
    for (let trial = 0; trial < 400; trial++) {
      const openMelds = trial % 4;
      const size = 16 - 3 * openMelds - (trial % 2);
      const hand = shuffle(deck, rng).slice(0, size);
      const c = countsFromTiles(hand);
      expect(shanten(c, openMelds), `hand ${hand.sort((a, b) => a - b).join(',')}`).toBe(
        shantenReference(c, openMelds),
      );
    }
  });

  it('matches the reference on single-suit and honor-only hands', () => {
    const specs = [
      '1112345678999m',
      '111222333444m 55m',
      'EEE SSS WWW NNN RRR GG',
      '19m 19p 19s ESWN RG Wh 1m',
      '123456789m 123p 45s 6s',
      '1111m 2222m 3333m 4444m',
      '11m 22m 33m 44m 55m 66m 77m 88m',
    ];
    for (const spec of specs) {
      const c = counts(spec);
      for (const openMelds of [0, 1, 2]) {
        expect(shanten(c, openMelds), `${spec} with ${openMelds} melds`).toBe(
          shantenReference(c, openMelds),
        );
      }
    }
  });
});
