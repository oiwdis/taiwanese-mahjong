import { describe, expect, it } from 'vitest';
import {
  buildClaimActions,
  buildRobbingActions,
  buildTurnActions,
  canResolveEarly,
  resolveClaims,
  type Declaration,
  type PlayerSnapshot,
  type WinCheckContext,
} from '../actions.js';
import { DEFAULT_RULES } from '../config.js';
import type { Meld } from '../meld.js';
import { countsFromTiles, parseTiles, tileFromString } from '../tiles.js';

const rules = { ...DEFAULT_RULES, minTai: 0 };

const ctx: WinCheckContext = {
  roundWind: 0,
  dealerSeat: 0,
  dealerStreak: 0,
  rules,
};

function snapshot(spec: string, over: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    seat: 1,
    concealed: countsFromTiles(parseTiles(spec)),
    melds: [],
    flowers: [],
    seatWind: 1,
    passedWater: false,
    ...over,
  };
}

describe('nothing is automatic', () => {
  it('always offers an explicit pass when a call is available', () => {
    const p = snapshot('1122334455667m 88p 9s');
    const actions = buildClaimActions(p, tileFromString('3m'), 0, ctx);
    expect(actions.some((a) => a.type === 'pass')).toBe(true);
  });

  it('offers no actions at all when nothing can be claimed', () => {
    const p = snapshot('1111m 2222p 3333s EEEE');
    const actions = buildClaimActions(p, tileFromString('9s'), 0, ctx);
    expect(actions).toEqual([]);
  });

  it('never auto-wins: the win is one choice among several', () => {
    // Tenpai on 4p/7p with 56p, and also holding three 5s for a pung/kong.
    const p = snapshot('123m 456m 789m 56p 555s');
    const actions = buildClaimActions(p, tileFromString('5s'), 0, ctx);
    const types = actions.map((a) => a.type);
    expect(types).toContain('kong');
    expect(types).toContain('pung');
    expect(types).toContain('pass');
  });
});

describe('chow choices', () => {
  it('offers every distinct run separately', () => {
    // Holding 3m 4m 6m, a discarded 5m can make 345m or 456m but not 567m.
    const p = snapshot('34m 6m 111p 222p 333p 99s');
    const actions = buildClaimActions(p, tileFromString('5m'), 0, ctx);
    const chows = actions.filter((a) => a.type === 'chow');
    expect(chows.map((c) => c.chowLow).sort()).toEqual([
      tileFromString('3m'),
      tileFromString('4m'),
    ]);
    expect(chows.map((c) => c.label)).toContain('Chi 4m-5m-6m');
  });

  it('offers three runs when the hand surrounds the discard', () => {
    // 34567m around a discarded 5m gives 345m, 456m and 567m.
    const p = snapshot('34567m 111p 222p 333p 99s');
    const actions = buildClaimActions(p, tileFromString('5m'), 0, ctx);
    const chows = actions.filter((a) => a.type === 'chow');
    expect(chows.map((c) => c.chowLow)).toEqual([
      tileFromString('3m'),
      tileFromString('4m'),
      tileFromString('5m'),
    ]);
  });

  it('only allows a chow from the player to the left', () => {
    const p = snapshot('34m 6m 111p 222p 333p 99s', { seat: 1 });
    // Seat 0 is immediately before seat 1, so chows are allowed.
    expect(
      buildClaimActions(p, tileFromString('5m'), 0, ctx).some((a) => a.type === 'chow'),
    ).toBe(true);
    // Seats 2 and 3 are not.
    for (const from of [2, 3]) {
      expect(
        buildClaimActions(p, tileFromString('5m'), from, ctx).some((a) => a.type === 'chow'),
      ).toBe(false);
    }
  });

  it('will not build a run across a suit boundary', () => {
    const p = snapshot('89m 1p 111p 222p 333s 99s', { seat: 1 });
    const actions = buildClaimActions(p, tileFromString('9m'), 0, ctx);
    const chows = actions.filter((a) => a.type === 'chow');
    // 8m 9m plus 1p is not a run, so only 789m-style options could appear and
    // this hand has no 7m.
    expect(chows).toHaveLength(0);
  });
});

describe('pung and kong are separate choices', () => {
  it('offers both when three copies are held', () => {
    const p = snapshot('EEE 123m 456m 789m 11p 2p');
    const actions = buildClaimActions(p, tileFromString('E'), 0, ctx);
    expect(actions.filter((a) => a.type === 'kong')).toHaveLength(1);
    expect(actions.filter((a) => a.type === 'pung')).toHaveLength(1);
  });

  it('offers only the pung when two copies are held', () => {
    const p = snapshot('EE 123m 456m 789m 11p 22p');
    const actions = buildClaimActions(p, tileFromString('E'), 0, ctx);
    expect(actions.filter((a) => a.type === 'kong')).toHaveLength(0);
    expect(actions.filter((a) => a.type === 'pung')).toHaveLength(1);
  });
});

describe('passed water (過水)', () => {
  it('flags the pass that gives up a win', () => {
    const p = snapshot('123m 456m 789m 234p 56p 55s');
    const actions = buildClaimActions(p, tileFromString('7p'), 0, ctx);
    const win = actions.find((a) => a.type === 'win');
    const pass = actions.find((a) => a.type === 'pass');
    expect(win).toBeDefined();
    expect(pass?.armsPassedWater).toBe(true);
    expect(pass?.label).toContain('gives up');
  });

  it('does not flag a pass that only gives up a chow', () => {
    const p = snapshot('34m 6m 111p 222p 333p 99s');
    const actions = buildClaimActions(p, tileFromString('5m'), 0, ctx);
    expect(actions.find((a) => a.type === 'pass')?.armsPassedWater).toBeFalsy();
  });

  it('withholds the win entirely while a player is passed water', () => {
    const p = snapshot('123m 456m 789m 234p 56p 55s', { passedWater: true });
    const actions = buildClaimActions(p, tileFromString('7p'), 0, ctx);
    expect(actions.some((a) => a.type === 'win')).toBe(false);
  });

  it('withholds a self-draw while a player is passed water', () => {
    const p = snapshot('123m 456m 789m 234p 567p 55s', { passedWater: true });
    const actions = buildTurnActions({
      player: p,
      drawnTile: tileFromString('7p'),
      kongReplacement: false,
      lastDraw: false,
      allowWin: true,
      ctx,
    });
    expect(actions.some((a) => a.type === 'win')).toBe(false);
  });
});

describe('turn actions', () => {
  it('offers a self-draw as an explicit declaration', () => {
    const p = snapshot('123m 456m 789m 234p 567p 55s');
    const actions = buildTurnActions({
      player: p,
      drawnTile: tileFromString('7p'),
      kongReplacement: false,
      lastDraw: false,
      allowWin: true,
      ctx,
    });
    const win = actions.find((a) => a.type === 'win');
    expect(win).toBeDefined();
    expect(win?.taiPreview).toBeGreaterThan(0);
  });

  it('withholds the win after a call, since the claimed tile is spoken for', () => {
    const p = snapshot('123m 456m 789m 234p 567p 55s');
    const actions = buildTurnActions({
      player: p,
      drawnTile: tileFromString('7p'),
      kongReplacement: false,
      lastDraw: false,
      allowWin: false,
      ctx,
    });
    expect(actions.some((a) => a.type === 'win')).toBe(false);
  });

  it('offers a concealed kong for four copies', () => {
    const p = snapshot('EEEE 123m 456m 789m 11p 2p');
    const actions = buildTurnActions({
      player: p,
      drawnTile: tileFromString('2p'),
      kongReplacement: false,
      lastDraw: false,
      allowWin: true,
      ctx,
    });
    const kong = actions.find((a) => a.type === 'concealedKong');
    expect(kong?.tile).toBe(tileFromString('E'));
  });

  it('offers an added kong for a pung already on the table', () => {
    const melds: Meld[] = [
      { kind: 'pung', tile: tileFromString('E'), concealed: false, fromSeat: 0 },
    ];
    const p = snapshot('E 123m 456m 789m 11p', { melds });
    const actions = buildTurnActions({
      player: p,
      drawnTile: tileFromString('E'),
      kongReplacement: false,
      lastDraw: false,
      allowWin: true,
      ctx,
    });
    expect(actions.some((a) => a.type === 'addedKong')).toBe(true);
  });

  it('offers 八仙過海 as a declaration rather than taking the win', () => {
    const p = snapshot('123m 456m 789m 234p 56p 55s', {
      flowers: ['Sp', 'Su', 'Au', 'Wi', 'Pl', 'Or', 'Ch', 'Ba'].map(tileFromString),
    });
    const actions = buildTurnActions({
      player: p,
      drawnTile: null,
      kongReplacement: false,
      lastDraw: false,
      allowWin: true,
      ctx,
    });
    expect(actions.some((a) => a.type === 'flowerWin')).toBe(true);
  });
});

describe('robbing a kong', () => {
  it('offers the win and an explicit pass', () => {
    const p = snapshot('123m 456m 789m 234p 56p 55s');
    const actions = buildRobbingActions(p, tileFromString('7p'), ctx);
    expect(actions.map((a) => a.type)).toEqual(['win', 'pass']);
    expect(actions[1]!.armsPassedWater).toBe(true);
  });

  it('offers nothing when the kong tile does not complete the hand', () => {
    const p = snapshot('123m 456m 789m 234p 56p 55s');
    expect(buildRobbingActions(p, tileFromString('9s'), ctx)).toEqual([]);
  });
});

describe('claim priority', () => {
  const win = { id: 'w', type: 'win' as const, label: 'win' };
  const pung = { id: 'p', type: 'pung' as const, label: 'pung' };
  const chow = { id: 'c', type: 'chow' as const, label: 'chow' };
  const pass = { id: 'x', type: 'pass' as const, label: 'pass' };

  it('ranks a win over a pung over a chow', () => {
    const decls: Declaration[] = [
      { seat: 1, action: chow },
      { seat: 2, action: pung },
      { seat: 3, action: win },
    ];
    expect(resolveClaims(decls, 0, rules).winning.map((d) => d.seat)).toEqual([3]);
  });

  it('ranks a pung over a chow', () => {
    const decls: Declaration[] = [
      { seat: 1, action: chow },
      { seat: 2, action: pung },
    ];
    expect(resolveClaims(decls, 0, rules).winning.map((d) => d.seat)).toEqual([2]);
  });

  it('gives a contested win to the seat nearest the discarder', () => {
    const decls: Declaration[] = [
      { seat: 3, action: win },
      { seat: 1, action: win },
    ];
    expect(resolveClaims(decls, 0, rules).winning.map((d) => d.seat)).toEqual([1]);
  });

  it('allows multiple winners only when the table enables it', () => {
    const decls: Declaration[] = [
      { seat: 3, action: win },
      { seat: 1, action: win },
    ];
    const multi = resolveClaims(decls, 0, { ...rules, multipleWinnersPerDiscard: true });
    expect(multi.winning.map((d) => d.seat)).toEqual([1, 3]);
  });

  it('resolves to nothing when everyone passes', () => {
    const decls: Declaration[] = [
      { seat: 1, action: pass },
      { seat: 2, action: pass },
    ];
    expect(resolveClaims(decls, 0, rules).winning).toEqual([]);
  });

  it('waits for outstanding seats that could outrank the best declaration', () => {
    const declarations: Declaration[] = [{ seat: 1, action: chow }];
    const pending = [{ seat: 2, actions: [pung, pass] }];
    expect(canResolveEarly(declarations, pending)).toBe(false);
  });

  it('resolves early when no outstanding seat can outrank a declared win', () => {
    const declarations: Declaration[] = [{ seat: 1, action: win }];
    const pending = [{ seat: 2, actions: [chow, pass] }];
    expect(canResolveEarly(declarations, pending)).toBe(true);
  });
});
