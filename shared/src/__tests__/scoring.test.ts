import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, type RulesConfig } from '../config.js';
import { dealershipTaiFor, scoreHand, settle, type WinContext } from '../scoring.js';
import type { Meld } from '../meld.js';
import { countsFromTiles, parseTiles, tileFromString, type Tile } from '../tiles.js';

const rules: RulesConfig = { ...DEFAULT_RULES, base: 30, taiValue: 10 };

function ctx(spec: string, winningTile: string, over: Partial<WinContext> = {}): WinContext {
  return {
    concealed: countsFromTiles(parseTiles(spec)),
    melds: [],
    flowers: [],
    winningTile: tileFromString(winningTile),
    selfDraw: false,
    seatWind: 1,
    roundWind: 1,
    isDealer: false,
    dealerStreak: 0,
    robbingKong: false,
    kongReplacement: false,
    lastDiscard: false,
    lastDraw: false,
    flowerWin: false,
    ...over,
  };
}

function keys(spec: string, winningTile: string, over: Partial<WinContext> = {}, r = rules) {
  const scored = scoreHand(ctx(spec, winningTile, over), r);
  return {
    total: scored.handTai,
    keys: scored.items.map((i) => i.key).sort(),
    byKey: Object.fromEntries(scored.items.map((i) => [i.key, i.tai])),
  };
}

describe('all chows (平胡)', () => {
  // 56p waiting on 4p/7p, won on the 7p discard. No honors, no triplets,
  // no flowers, not self-drawn.
  const hand = '123m 456m 789m 234p 567p 55s';

  it('scores 平胡 alongside 門清 by default', () => {
    const r = keys(hand, '7p');
    expect(r.keys).toEqual(['allChows', 'concealed']);
    expect(r.total).toBe(3);
  });

  it('is voided by pingHuStrict when anything else scores', () => {
    const r = keys(hand, '7p', {}, { ...rules, pingHuStrict: true });
    expect(r.keys).toEqual(['concealed']);
    expect(r.total).toBe(1);
  });

  it('is voided by a self-draw', () => {
    const r = keys(hand, '7p', { selfDraw: true });
    expect(r.keys).not.toContain('allChows');
  });

  it('is voided by holding a flower', () => {
    const r = keys(hand, '7p', { flowers: [tileFromString('Sp')] });
    expect(r.keys).not.toContain('allChows');
  });

  it('is voided by a closed wait, scoring 獨聽 instead', () => {
    // Same tiles, but won on the 6p that fills the middle of 5p_7p. That is a
    // one-tile wait, so it is 獨聽 rather than the two-sided wait 平胡 needs.
    const closed = keys(hand, '6p');
    expect(closed.keys).toContain('singleWait');
    expect(closed.keys).not.toContain('allChows');
  });
});

describe('triplet patterns', () => {
  it('scores five concealed pungs and suppresses the lower tiers', () => {
    const r = keys('111m 222m 333p EEE RRR 55s', '5s');
    expect(r.keys).toContain('fiveConcealedPungs');
    expect(r.keys).not.toContain('fourConcealedPungs');
    expect(r.keys).not.toContain('threeConcealedPungs');
    expect(r.byKey.allPungs).toBe(4);
    expect(r.byKey.dragonPung).toBe(1);
    expect(r.byKey.singleWait).toBe(1);
    // 4 all pungs + 8 five concealed + 1 dragon + 1 concealed + 1 single wait
    expect(r.total).toBe(15);
  });

  it('counts wind tai only for the seat and round winds', () => {
    // Seat South, round South, holding an East triplet: no wind tai.
    const none = keys('111m 222m 333p EEE RRR 55s', '5s', { seatWind: 1, roundWind: 1 });
    expect(none.keys).not.toContain('seatWind');
    expect(none.keys).not.toContain('roundWind');

    // Seat East, round East: the same triplet scores both (東風東).
    const both = keys('111m 222m 333p EEE RRR 55s', '5s', { seatWind: 0, roundWind: 0 });
    expect(both.byKey.seatWind).toBe(1);
    expect(both.byKey.roundWind).toBe(1);
  });
});

describe('dragons', () => {
  it('scores great three dragons and suppresses the per-pung tai', () => {
    const melds: Meld[] = [
      { kind: 'pung', tile: tileFromString('R'), concealed: false, fromSeat: 2 },
    ];
    const scored = scoreHand(
      ctx('GGG WhWhWh 123m 456m 77p', '7p', { melds }),
      rules,
    );
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('greatThreeDragons');
    expect(k).not.toContain('dragonPung');
    expect(k).not.toContain('concealed');
    expect(scored.handTai).toBe(9); // 8 + single wait
  });

  it('scores small three dragons when the third dragon is the pair', () => {
    const scored = scoreHand(ctx('RRR GGG 123m 456m 789m WhWh', '4m'), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('smallThreeDragons');
    expect(k).not.toContain('dragonPung');
  });
});

describe('winds', () => {
  it('scores big four winds and suppresses seat and round wind tai', () => {
    const scored = scoreHand(
      ctx('EEE SSS WWW NNN 111m 22m', '2m', { seatWind: 0, roundWind: 0 }),
      rules,
    );
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('greatFourWinds');
    expect(k).not.toContain('seatWind');
    expect(k).not.toContain('roundWind');
  });

  it('scores small four winds and keeps the wind tai', () => {
    const scored = scoreHand(
      ctx('EEE SSS WWW 111m 222m NN', '2m', { seatWind: 0, roundWind: 0 }),
      rules,
    );
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('smallFourWinds');
    expect(k).toContain('seatWind');
    expect(k).toContain('roundWind');
  });
});

describe('suit patterns', () => {
  it('scores pure one suit', () => {
    const scored = scoreHand(ctx('123m 456m 789m 234m 567m 99m', '7m'), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('pureOneSuit');
    expect(k).not.toContain('mixedOneSuit');
  });

  it('scores mixed one suit when honors are present', () => {
    const scored = scoreHand(ctx('123m 456m 789m 234m EEE 99m', 'E'), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('mixedOneSuit');
    expect(k).not.toContain('pureOneSuit');
  });

  it('scores all honors', () => {
    const scored = scoreHand(ctx('EEE SSS WWW NNN RRR GG', 'G'), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('allHonors');
    expect(k).toContain('allPungs');
    expect(k).not.toContain('mixedOneSuit');
  });
});

describe('concealment', () => {
  it('replaces 門清 and 自摸 with 不求', () => {
    const r = keys('123m 456m 789m 123p 456p 99s', '9s', { selfDraw: true });
    expect(r.keys).toContain('concealedSelfDraw');
    expect(r.keys).not.toContain('concealed');
    expect(r.keys).not.toContain('selfDraw');
    expect(r.byKey.concealedSelfDraw).toBe(3);
  });

  it('keeps 門清 when a concealed kong is declared', () => {
    const melds: Meld[] = [{ kind: 'kong', tile: tileFromString('R'), concealed: true }];
    const scored = scoreHand(ctx('123m 456m 789m 234p 55s', '5s', { melds }), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('concealed');
  });

  it('loses 門清 when a pung is called', () => {
    const melds: Meld[] = [
      { kind: 'pung', tile: tileFromString('R'), concealed: false, fromSeat: 1 },
    ];
    const scored = scoreHand(ctx('123m 456m 789m 234p 55s', '5s', { melds }), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).not.toContain('concealed');
  });
});

describe('flowers', () => {
  it('scores one tai per own flower', () => {
    // Seat East owns 春 and 梅.
    const r = keys('123m 456m 789m 234p 567p 55s', '7p', {
      seatWind: 0,
      flowers: [tileFromString('Sp'), tileFromString('Pl'), tileFromString('Su')],
    });
    expect(r.byKey.ownFlower).toBe(2);
  });

  it('scores 花槓 for a full set of seasons and keeps the own-flower tai', () => {
    const r = keys('123m 456m 789m 234p 567p 55s', '7p', {
      seatWind: 0,
      flowers: ['Sp', 'Su', 'Au', 'Wi'].map(tileFromString),
    });
    expect(r.byKey.flowerSet).toBe(2);
    expect(r.byKey.ownFlower).toBe(1);
  });

  it('scores 八仙過海 on its own', () => {
    const scored = scoreHand(
      ctx('123m 456m 789m 234p 567p 55s', '7p', {
        flowerWin: true,
        flowers: ['Sp', 'Su', 'Au', 'Wi', 'Pl', 'Or', 'Ch', 'Ba'].map(tileFromString),
      }),
      rules,
    );
    expect(scored.items.map((i) => i.key)).toEqual(['eightFlowers']);
    expect(scored.handTai).toBe(8);
  });
});

describe('all melded (全求)', () => {
  const melds: Meld[] = [
    { kind: 'pung', tile: tileFromString('R'), concealed: false, fromSeat: 1 },
    { kind: 'pung', tile: tileFromString('G'), concealed: false, fromSeat: 1 },
    { kind: 'chow', tile: tileFromString('1m'), concealed: false, fromSeat: 3 },
    { kind: 'chow', tile: tileFromString('4m'), concealed: false, fromSeat: 3 },
    { kind: 'chow', tile: tileFromString('7m'), concealed: false, fromSeat: 3 },
  ];

  it('scores 全求 on a discard', () => {
    const scored = scoreHand(ctx('55s', '5s', { melds }), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('allMelded');
    expect(k).not.toContain('halfMelded');
  });

  it('scores 半求 on a self-draw', () => {
    const scored = scoreHand(ctx('55s', '5s', { melds, selfDraw: true }), rules);
    const k = scored.items.map((i) => i.key);
    expect(k).toContain('halfMelded');
    expect(k).not.toContain('allMelded');
  });
});

describe('situational tai', () => {
  it('scores robbing a kong', () => {
    const r = keys('123m 456m 789m 234p 567p 55s', '7p', { robbingKong: true });
    expect(r.byKey.robbingKong).toBe(1);
  });

  it('scores a win on a kong replacement, stacking with self-draw', () => {
    const r = keys('123m 456m 789m 234p 567p 55s', '7p', {
      selfDraw: true,
      kongReplacement: true,
    });
    expect(r.byKey.kongReplacement).toBe(1);
    expect(r.byKey.concealedSelfDraw).toBe(3);
  });

  it('scores 海底撈月 with 自摸', () => {
    const r = keys('123m 456m 789m 234p 567p 55s', '7p', {
      selfDraw: true,
      lastDraw: true,
    });
    expect(r.byKey.lastDraw).toBe(1);
  });
});

describe('caps and minimums', () => {
  it('caps the hand tai when maxTai is set', () => {
    const capped = scoreHand(ctx('EEE SSS WWW NNN RRR GG', 'G', { seatWind: 0, roundWind: 0 }), {
      ...rules,
      maxTai: 8,
    });
    expect(capped.capped).toBe(true);
    expect(capped.handTai).toBe(8);
    expect(capped.rawHandTai).toBeGreaterThan(8);
  });
});

describe('dealership tai', () => {
  it('is 2N+1', () => {
    expect(dealershipTaiFor(0, rules)).toBe(1);
    expect(dealershipTaiFor(1, rules)).toBe(3);
    expect(dealershipTaiFor(2, rules)).toBe(5);
    expect(dealershipTaiFor(5, rules)).toBe(11);
  });

  it('respects the streak cap', () => {
    expect(dealershipTaiFor(20, { ...rules, streakCap: 10 })).toBe(21);
    expect(dealershipTaiFor(20, { ...rules, streakCap: 3 })).toBe(7);
  });
});

describe('settlement', () => {
  const args = { handTai: 5, dealershipTai: 3, rules };

  it('charges the discarder alone, plus the dealership when the dealer wins', () => {
    const s = settle({ ...args, winnerSeat: 0, discarderSeat: 2, dealerSeat: 0 });
    // 5 + 3 tai = 8 -> 30 + 80 = 110
    expect(s.deltas).toEqual([110, 0, -110, 0]);
    expect(s.lines[0]!.includesDealership).toBe(true);
  });

  it('charges all three on a self-draw, with the dealer paying the streak', () => {
    const s = settle({ ...args, winnerSeat: 1, discarderSeat: null, dealerSeat: 0 });
    // Dealer pays 8 tai (110); the other two pay 5 tai (80).
    expect(s.deltas).toEqual([-110, 270, -80, -80]);
  });

  it('charges the dealership to a dealer who fires the gun', () => {
    const s = settle({ ...args, winnerSeat: 1, discarderSeat: 0, dealerSeat: 0 });
    expect(s.deltas).toEqual([-110, 110, 0, 0]);
  });

  it('leaves the dealer out when two non-dealers trade a discard', () => {
    const s = settle({ ...args, winnerSeat: 1, discarderSeat: 2, dealerSeat: 0 });
    // 5 tai -> 30 + 50 = 80, and the dealer is not involved at all.
    expect(s.deltas).toEqual([0, 80, -80, 0]);
    expect(s.lines[0]!.includesDealership).toBe(false);
  });

  it('conserves money', () => {
    for (const discarder of [null, 0, 2, 3]) {
      const s = settle({ ...args, winnerSeat: 1, discarderSeat: discarder, dealerSeat: 0 });
      expect(s.deltas.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});
