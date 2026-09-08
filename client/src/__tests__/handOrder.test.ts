import { describe, expect, it } from 'vitest';
import { parseTiles } from '@mahjong/shared';
import { dealKeyOf, insertSorted, moveTile, reconcileHand, sameMultiset } from '../handOrder.js';

describe('reconcileHand', () => {
  it('slots a draw into sorted order without reshuffling the rest', () => {
    expect(reconcileHand(parseTiles('1m 3m 9p'), parseTiles('1m 2m 3m 9p'))).toEqual(
      parseTiles('1m 2m 3m 9p'),
    );
    expect(reconcileHand(parseTiles('1m 2m 3m 9p'), parseTiles('1m 2m 3m 5m 9p'))).toEqual(
      parseTiles('1m 2m 3m 5m 9p'),
    );
  });

  it('places a drawn copy next to its matches', () => {
    expect(reconcileHand(parseTiles('1m 5p 9s'), parseTiles('1m 5p 5p 9s'))).toEqual(
      parseTiles('1m 5p 5p 9s'),
    );
  });

  it('keeps a custom arrangement and only slots the new tile', () => {
    expect(reconcileHand(parseTiles('9s 1m 5p'), parseTiles('9s 1m 3m 5p'))).toEqual(
      parseTiles('9s 1m 3m 5p'),
    );
  });

  it('drops discarded tiles without reshuffling the rest', () => {
    const previous = parseTiles('9p 3m 1m 2m');
    const incoming = parseTiles('1m 2m 3m');
    expect(reconcileHand(previous, incoming)).toEqual(parseTiles('3m 1m 2m'));
  });

  it('treats duplicate tiles independently', () => {
    expect(reconcileHand(parseTiles('5p 5p 1m'), parseTiles('1m 5p 5p'))).toEqual(
      parseTiles('5p 5p 1m'),
    );
  });

  it('starts sorted when there is no previous hand', () => {
    expect(reconcileHand([], parseTiles('3m 1m 2m'))).toEqual(parseTiles('1m 2m 3m'));
  });
});

describe('insertSorted', () => {
  it('inserts after every tile that sorts at or before it', () => {
    expect(insertSorted(parseTiles('1m 3m 5m'), parseTiles('3m')[0]!)).toEqual(
      parseTiles('1m 3m 3m 5m'),
    );
    expect(insertSorted(parseTiles('1m 3m 5m'), parseTiles('9p')[0]!)).toEqual(
      parseTiles('1m 3m 5m 9p'),
    );
  });
});

describe('moveTile', () => {
  it('moves a tile left or right', () => {
    expect(moveTile([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveTile([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });

  it('leaves the hand alone when the index does not change', () => {
    expect(moveTile([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });
});

describe('sameMultiset', () => {
  it('ignores order', () => {
    expect(sameMultiset(parseTiles('3m 1m'), parseTiles('1m 3m'))).toBe(true);
    expect(sameMultiset(parseTiles('3m 1m'), parseTiles('1m 2m'))).toBe(false);
  });
});

describe('dealKeyOf', () => {
  it('changes when a new hand is dealt', () => {
    const base = {
      roomCode: 'ABCD',
      you: 0,
      roundWind: 0,
      roundNumber: 1,
      handNumber: 1,
    };
    expect(dealKeyOf({ ...base, handNumber: 2 })).not.toBe(dealKeyOf(base));
  });
});
