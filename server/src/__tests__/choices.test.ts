import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, tileFromString, type Meld } from '@mahjong/shared';
import { Game } from '../game.js';

/**
 * The engine must never take a call on a player's behalf.
 *
 * Bots always accept an available win, so a bot-driven simulation never walks
 * the paths that matter most here: declining a win, being locked out by 過水,
 * and coming back out of it. These drive the engine by hand instead.
 */

const t = tileFromString;

function newGame(rules: Partial<typeof DEFAULT_RULES> = {}): Game {
  const game = new Game({ rules: { ...DEFAULT_RULES, minTai: 0, ...rules }, seed: 1 });
  for (let i = 0; i < 4; i++) game.addPlayer(`P${i}`, `token${i}`, false);
  game.startGame();
  return game;
}

/** Waiting on 4p or 7p. */
const TENPAI = '123m 456m 789m 111p 56p 55s';
/** The same hand with the 7p already in it, so it is complete. */
const COMPLETE = '123m 456m 789m 111p 567p 55s';

/**
 * Sixteen tiles of loose pairs: four away from waiting, so they cannot win on
 * anything, and each variant omits a whole suit so it cannot chow or pung
 * there either. Real hands make poor padding — `1111m 2222m 3333m 4444m` looks
 * inert but is actually waiting on 5m.
 */
const IDLE = {
  noMan: '11p 99p 11s 99s EE SS WW NN',
  noPin: '11m 99m 11s 99s EE SS WW NN',
  noHonor: '11m 99m 11p 99p 11s 99s 22m 88m',
};

/** A seventeen-tile hand that holds `tile` but cannot win or call. */
function idleHolding(idle: string, tile: string): string {
  return `${idle} ${tile}`;
}

function actionTypes(game: Game, seat: number): string[] {
  return (game.decisionFor(seat)?.actions ?? []).map((a) => a.type);
}

function findAction(game: Game, seat: number, type: string) {
  return game.decisionFor(seat)!.actions.find((a) => a.type === type);
}

/** Seat 0 throws a 7p that seat 1 is waiting on; nobody else can act. */
function discardIntoTenpai(game: Game, opts: { upcoming?: number[] } = {}): void {
  game.loadPosition({
    hands: [idleHolding(IDLE.noPin, '7p'), TENPAI, IDLE.noPin, IDLE.noPin],
    upcoming: opts.upcoming,
    toAct: 0,
    drawn: t('7p'),
  });
  game.discard(0, t('7p'));
}

describe('a discard is never claimed automatically', () => {
  it('stops and waits rather than resolving the claim itself', () => {
    const game = newGame();
    discardIntoTenpai(game);
    expect(game.phase).toBe('claiming');
    expect(game.waitingSeats()).toEqual([1]);
    // The tile is still sitting in the river, unclaimed.
    expect(game.players[0]!.discards).toContain(t('7p'));
    expect(game.result).toBeNull();
  });

  it('offers the win, the lesser call, and an explicit pass', () => {
    const game = newGame();
    discardIntoTenpai(game);
    // The 7p both completes the hand and extends 56p into a run, so winning
    // and chowing are both on the table and neither is assumed.
    expect(actionTypes(game, 1)).toEqual(['win', 'chow', 'pass']);
    expect(game.result).toBeNull();
  });

  it('ends the hand only once the win is declared', () => {
    const game = newGame();
    discardIntoTenpai(game);
    expect(game.act(1, findAction(game, 1, 'win')!.id)).toEqual({ ok: true });
    expect(game.result?.kind).toBe('win');
    expect(game.result?.winnerSeat).toBe(1);
    expect(game.result?.discarderSeat).toBe(0);
  });

  it('rejects a choice that was never offered', () => {
    const game = newGame();
    discardIntoTenpai(game);
    expect(game.act(1, 'chow:0')).toEqual({
      ok: false,
      error: 'That choice is not available',
    });
  });

  it('rejects a choice from a seat that was not asked', () => {
    const game = newGame();
    discardIntoTenpai(game);
    expect(game.act(2, 'pass')).toEqual({
      ok: false,
      error: 'Not your decision right now',
    });
  });
});

describe('passing on a win arms 過水', () => {
  it('flags the pass before it is taken', () => {
    const game = newGame();
    discardIntoTenpai(game);
    expect(findAction(game, 1, 'pass')!.armsPassedWater).toBe(true);
  });

  it('locks the player out once they pass', () => {
    const game = newGame();
    discardIntoTenpai(game);
    game.act(1, findAction(game, 1, 'pass')!.id);
    expect(game.players[1]!.passedWater).toBe(true);
  });

  it('withholds a discard win while locked out', () => {
    const game = newGame();
    game.loadPosition({
      hands: [idleHolding(IDLE.noPin, '7p'), TENPAI, IDLE.noPin, IDLE.noPin],
      passedWater: [false, true, false, false],
      toAct: 0,
      drawn: t('7p'),
    });
    game.discard(0, t('7p'));
    // Seat 1 is still waiting on 7p but cannot take it. The lock stops it
    // winning, not calling, so the chow on the same tile is still offered.
    const types = actionTypes(game, 1);
    expect(types).not.toContain('win');
    expect(types).toContain('chow');
    expect(game.result).toBeNull();
  });

  it('withholds a self-draw while locked out', () => {
    const game = newGame();
    game.loadPosition({
      hands: [COMPLETE, IDLE.noPin, IDLE.noPin, IDLE.noPin],
      passedWater: [true, false, false, false],
      toAct: 0,
      drawn: t('7p'),
    });
    expect(actionTypes(game, 0)).not.toContain('win');
    expect(game.decisionFor(0)!.decliningWinArmsPassedWater).toBe(false);
  });

  it('clears after drawing a tile that cannot win, then discarding', () => {
    const game = newGame();
    // Seat 1 will draw a 9m next, which does not complete its hand.
    discardIntoTenpai(game, { upcoming: [t('9m')] });

    game.act(1, findAction(game, 1, 'pass')!.id);
    expect(game.players[1]!.passedWater).toBe(true);

    // Play passed to seat 1, which drew the useless 9m.
    expect(game.currentSeat).toBe(1);
    expect(game.drawnTile).toBe(t('9m'));
    expect(game.players[1]!.clearPassedWaterOnDiscard).toBe(true);
    expect(game.players[1]!.passedWater).toBe(true);

    // Discarding completes the pass and lifts the lock.
    game.discard(1, t('9m'));
    expect(game.players[1]!.passedWater).toBe(false);
    expect(game.players[1]!.clearPassedWaterOnDiscard).toBe(false);
  });

  it('does not clear when the drawn tile would itself have won', () => {
    const game = newGame();
    // Seat 1 passes on 7p, then draws the 4p it is also waiting on.
    discardIntoTenpai(game, { upcoming: [t('4p')] });
    game.act(1, findAction(game, 1, 'pass')!.id);

    expect(game.currentSeat).toBe(1);
    expect(game.drawnTile).toBe(t('4p'));
    // The draw completes the hand, so this does not count as passing a hand.
    expect(game.players[1]!.clearPassedWaterOnDiscard).toBe(false);
    expect(actionTypes(game, 1)).not.toContain('win');

    game.discard(1, t('4p'));
    expect(game.players[1]!.passedWater).toBe(true);
  });

  it('does not arm on a pass that only gives up a chow', () => {
    const game = newGame();
    game.loadPosition({
      hands: [
        idleHolding(IDLE.noMan, '5m'),
        '346m 111p 222p 333p 99s 11s',
        IDLE.noMan,
        IDLE.noMan,
      ],
      toAct: 0,
      drawn: t('5m'),
    });
    game.discard(0, t('5m'));

    expect(actionTypes(game, 1)).toContain('chow');
    expect(findAction(game, 1, 'pass')!.armsPassedWater).toBeFalsy();
    game.act(1, findAction(game, 1, 'pass')!.id);
    expect(game.players[1]!.passedWater).toBe(false);
  });

  it('does not punish a player who declared a win but lost the priority race', () => {
    const game = newGame();
    game.loadPosition({
      hands: [idleHolding(IDLE.noPin, '7p'), TENPAI, IDLE.noPin, TENPAI],
      toAct: 0,
      drawn: t('7p'),
    });
    game.discard(0, t('7p'));

    // Both seat 1 and seat 3 can win; seat 1 is nearer the discarder.
    game.act(3, findAction(game, 3, 'win')!.id);
    game.act(1, findAction(game, 1, 'win')!.id);

    expect(game.result?.winnerSeat).toBe(1);
    // Seat 3 tried to win and was merely outranked, so it is not 過水.
    expect(game.players[3]!.passedWater).toBe(false);
  });
});

describe('every way of making a call is its own choice', () => {
  it('offers a pung and a kong separately when three copies are held', () => {
    const game = newGame();
    game.loadPosition({
      hands: [
        idleHolding(IDLE.noHonor, 'E'),
        'EEE 123m 456m 789m 11p 22p',
        IDLE.noHonor,
        IDLE.noHonor,
      ],
      toAct: 0,
      drawn: t('E'),
    });
    game.discard(0, t('E'));

    const types = actionTypes(game, 1);
    expect(types).toContain('pung');
    expect(types).toContain('kong');

    // Taking the pung leaves the fourth copy in hand.
    game.act(1, findAction(game, 1, 'pung')!.id);
    expect(game.players[1]!.melds).toHaveLength(1);
    expect(game.players[1]!.melds[0]!.kind).toBe('pung');
    expect(game.players[1]!.concealed[t('E')]).toBe(1);
  });

  it('builds exactly the chow that was chosen', () => {
    const game = newGame();
    game.loadPosition({
      hands: [
        idleHolding(IDLE.noMan, '5m'),
        '34567m 111p 222p 333p 99s',
        IDLE.noMan,
        IDLE.noMan,
      ],
      toAct: 0,
      drawn: t('5m'),
    });
    game.discard(0, t('5m'));

    const chows = game.decisionFor(1)!.actions.filter((a) => a.type === 'chow');
    expect(chows.map((c) => c.chowLow)).toEqual([t('3m'), t('4m'), t('5m')]);

    // Pick the middle option, 456m, and check that is exactly what appears.
    game.act(1, chows[1]!.id);
    const meld = game.players[1]!.melds[0]!;
    expect(meld.kind).toBe('chow');
    expect(meld.tile).toBe(t('4m'));
    // 4m and 6m left the hand; 3m, 5m and 7m stayed put.
    expect(game.players[1]!.concealed[t('3m')]).toBe(1);
    expect(game.players[1]!.concealed[t('4m')]).toBe(0);
    expect(game.players[1]!.concealed[t('5m')]).toBe(1);
    expect(game.players[1]!.concealed[t('6m')]).toBe(0);
    expect(game.players[1]!.concealed[t('7m')]).toBe(1);
  });

  it('owes a discard after calling, and offers no win on the claimed tile', () => {
    const game = newGame();
    game.loadPosition({
      hands: [
        idleHolding(IDLE.noHonor, 'E'),
        'EE 123m 456m 789m 111p 5s',
        IDLE.noHonor,
        IDLE.noHonor,
      ],
      toAct: 0,
      drawn: t('E'),
    });
    game.discard(0, t('E'));
    game.act(1, findAction(game, 1, 'pung')!.id);

    const decision = game.decisionFor(1)!;
    expect(decision.reason).toBe('postCall');
    expect(decision.canDiscard).toBe(true);
    expect(decision.actions.some((a) => a.type === 'win')).toBe(false);
  });
});

describe('claim priority', () => {
  it('waits for a seat that could outrank a declared chow', () => {
    const game = newGame();
    game.loadPosition({
      hands: [
        idleHolding(IDLE.noMan, '5m'),
        '346m 111p 222p 333p 99s 11s',
        '555m 123p 456p 789p 11s 22s',
        IDLE.noMan,
      ],
      toAct: 0,
      drawn: t('5m'),
    });
    game.discard(0, t('5m'));

    expect(actionTypes(game, 1)).toContain('chow');
    expect(actionTypes(game, 2)).toContain('pung');

    game.act(1, findAction(game, 1, 'chow')!.id);
    // The chow must not be executed while a pung is still possible.
    expect(game.players[1]!.melds).toHaveLength(0);
    expect(game.phase).toBe('claiming');

    game.act(2, findAction(game, 2, 'pung')!.id);
    expect(game.players[2]!.melds).toHaveLength(1);
    expect(game.players[2]!.melds[0]!.kind).toBe('pung');
    expect(game.players[1]!.melds).toHaveLength(0);
  });

  it('resolves as soon as nothing outstanding can outrank a declared win', () => {
    const game = newGame();
    game.loadPosition({
      hands: [
        idleHolding(IDLE.noPin, '7p'),
        TENPAI,
        '77p 123m 456m 789m 11s 22s 3s',
        IDLE.noPin,
      ],
      toAct: 0,
      drawn: t('7p'),
    });
    game.discard(0, t('7p'));

    // Seat 2 could only pung, so seat 1's win settles it without waiting.
    expect(actionTypes(game, 2)).toContain('pung');
    game.act(1, findAction(game, 1, 'win')!.id);
    expect(game.result?.winnerSeat).toBe(1);
  });
});

describe('kongs and robbing', () => {
  const pungOf7p: Meld[][] = [
    [],
    [{ kind: 'pung', tile: t('7p'), concealed: false, fromSeat: 0 }],
    [],
    [],
  ];

  it('exposes an added kong for robbing before completing it', () => {
    const game = newGame();
    game.loadPosition({
      hands: [IDLE.noPin, '123m 456m 789m 11s 22s 7p', TENPAI, IDLE.noPin],
      melds: pungOf7p,
      toAct: 1,
      drawn: t('7p'),
    });

    game.act(1, findAction(game, 1, 'addedKong')!.id);

    // Seat 2 is waiting on 7p, so the kong is offered up to be robbed.
    expect(game.phase).toBe('robbing');
    expect(game.waitingSeats()).toEqual([2]);
    expect(actionTypes(game, 2)).toEqual(['win', 'pass']);
    // Still a pung, because the kong has not been completed yet.
    expect(game.players[1]!.melds[0]!.kind).toBe('pung');

    game.act(2, findAction(game, 2, 'win')!.id);
    expect(game.result?.winnerSeat).toBe(2);
    expect(game.result?.scored?.items.some((i) => i.key === 'robbingKong')).toBe(true);
  });

  it('completes the kong when the chance to rob is declined', () => {
    const game = newGame();
    game.loadPosition({
      hands: [IDLE.noPin, '123m 456m 789m 11s 22s 7p', TENPAI, IDLE.noPin],
      melds: pungOf7p,
      toAct: 1,
      drawn: t('7p'),
    });

    game.act(1, findAction(game, 1, 'addedKong')!.id);
    game.act(2, findAction(game, 2, 'pass')!.id);

    expect(game.players[1]!.melds[0]!.kind).toBe('kong');
    expect(game.players[1]!.melds[0]!.wasAddedKong).toBe(true);
    // Declining the robbery is still declining a win.
    expect(game.players[2]!.passedWater).toBe(true);
    // The konger drew a replacement, so it is their decision again.
    expect(game.currentSeat).toBe(1);
    expect(game.decisionFor(1)!.canDiscard).toBe(true);
  });

  it('offers a concealed kong without declaring it', () => {
    const game = newGame();
    game.loadPosition({
      hands: ['EEEE 123m 456m 789m 11p 2p', IDLE.noHonor, IDLE.noHonor, IDLE.noHonor],
      toAct: 0,
      drawn: t('2p'),
    });
    const kong = findAction(game, 0, 'concealedKong')!;
    expect(kong.tile).toBe(t('E'));
    // Nothing happened yet: the four tiles are still in hand.
    expect(game.players[0]!.concealed[t('E')]).toBe(4);
    expect(game.players[0]!.melds).toHaveLength(0);

    game.act(0, kong.id);
    expect(game.players[0]!.melds[0]).toMatchObject({ kind: 'kong', concealed: true });
    expect(game.players[0]!.concealed[t('E')]).toBe(0);

    const owner = game.buildView(0);
    const other = game.buildView(1);
    expect(owner.players[0]!.melds[0]!.tile).toBe(t('E'));
    expect(other.players[0]!.melds[0]!.tile).toBe(-1);
    expect(other.log.join(' ')).toContain('concealed gang');
    expect(other.log.join(' ')).not.toMatch(/\bE\b/);
  });
});

describe('advancing after a hand', () => {
  function winAHand(): Game {
    const game = newGame();
    discardIntoTenpai(game);
    game.act(1, findAction(game, 1, 'win')!.id);
    expect(game.phase).toBe('handOver');
    return game;
  }

  it('does not start the next hand until every connected human is ready', () => {
    const game = winAHand();
    game.readyForNextHand(0);
    game.readyForNextHand(1);
    game.readyForNextHand(2);
    expect(game.phase).toBe('handOver');
    game.readyForNextHand(3);
    expect(game.phase).toBe('acting');
  });

  it('does not wait on a human who dropped after the summary appeared', () => {
    const game = winAHand();
    game.readyForNextHand(0);
    game.readyForNextHand(1);
    game.readyForNextHand(2);
    expect(game.phase).toBe('handOver');
    game.markDisconnected(3);
    expect(game.phase).toBe('acting');
  });

  it('starts as soon as the last still-connected human presses next', () => {
    const game = winAHand();
    game.players[3]!.connected = false;
    game.readyForNextHand(0);
    game.readyForNextHand(1);
    expect(game.phase).toBe('handOver');
    game.readyForNextHand(2);
    expect(game.phase).toBe('acting');
  });
});

describe('discarding when a win was available', () => {
  it('warns through the decision and arms 過水 on the discard', () => {
    const game = newGame();
    game.loadPosition({
      hands: [COMPLETE, IDLE.noPin, IDLE.noPin, IDLE.noPin],
      toAct: 0,
      drawn: t('7p'),
    });

    const decision = game.decisionFor(0)!;
    expect(decision.decliningWinArmsPassedWater).toBe(true);
    expect(decision.actions.some((a) => a.type === 'win')).toBe(true);

    // Throwing something instead of declaring the self-draw gives up the win.
    game.discard(0, t('5s'));
    expect(game.players[0]!.passedWater).toBe(true);
    expect(game.result).toBeNull();
  });

  it('does not warn when no win is available', () => {
    const game = newGame();
    game.loadPosition({
      hands: [TENPAI, IDLE.noPin, IDLE.noPin, IDLE.noPin],
      toAct: 0,
      drawn: t('5s'),
    });
    expect(game.decisionFor(0)!.decliningWinArmsPassedWater).toBe(false);
    game.discard(0, t('5s'));
    expect(game.players[0]!.passedWater).toBe(false);
  });

  it('respects the table minimum, so a hand below it is not offered as a win', () => {
    const game = newGame({ minTai: 5 });
    game.loadPosition({
      hands: [COMPLETE, IDLE.noPin, IDLE.noPin, IDLE.noPin],
      toAct: 0,
      drawn: t('7p'),
    });
    // 平胡 plus 門清 is only 3 tai, below the table's 5.
    expect(actionTypes(game, 0)).not.toContain('win');
    expect(game.decisionFor(0)!.decliningWinArmsPassedWater).toBe(false);
  });
});
