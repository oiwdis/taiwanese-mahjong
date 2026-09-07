/**
 * Ending a game and setting up the next one.
 *
 * Covers both exits from a finished game: straight into another game, or back
 * to the lobby with the same four people still seated.
 */
import { describe, expect, it } from 'vitest';
import { SEAT_COUNT, totalCount } from '@mahjong/shared';
import { Game } from '../game.js';
import { chooseBotMove } from '../bot.js';

/** Seat a human at east plus three bots, the shape a real table ends up in. */
function seatedGame(): Game {
  const game = new Game({ rules: { rounds: 1, maxHandsPerGame: 40 }, seed: 7 });
  game.addPlayer('Elliot', 'human-token', false);
  game.addPlayer('Ah-Ming', 'bot-1', true);
  game.addPlayer('Hsiao-Yu', 'bot-2', true);
  game.addPlayer('Chen', 'bot-3', true);
  return game;
}

/**
 * Play the whole game out with bot moves, acknowledging each hand summary on
 * the human's behalf, so the test reaches a genuine gameOver state.
 */
function playToTheEnd(game: Game): void {
  for (let guard = 0; guard < 200000 && game.phase !== 'gameOver'; guard++) {
    if (game.phase === 'handOver') {
      // Bots mark themselves ready; the seated human has to be answered for.
      for (const p of game.players) game.readyForNextHand(p.seat);
      continue;
    }

    const seats = game.waitingSeats();
    if (seats.length === 0) throw new Error(`nothing to do in phase ${game.phase}`);
    for (const seat of seats) {
      const move = chooseBotMove(game, seat);
      if (!move) continue;
      if (move.kind === 'act') game.act(seat, move.actionId);
      else game.discard(seat, move.tile);
    }
  }
}

describe('finishing a game', () => {
  it('reaches gameOver with the money still adding to zero', () => {
    const game = seatedGame();
    game.startGame();
    playToTheEnd(game);

    expect(game.phase).toBe('gameOver');
    expect(game.players.reduce((sum, p) => sum + p.score, 0)).toBe(0);
    expect(game.history.length).toBeGreaterThan(0);
  });
});

describe('returning to the lobby', () => {
  it('is refused while a game is still running', () => {
    const game = seatedGame();
    game.startGame();
    expect(game.phase).not.toBe('gameOver');

    const res = game.returnToLobby();
    expect(res.ok).toBe(false);
    expect(game.phase).not.toBe('lobby');
  });

  it('keeps everyone in their seat and clears the finished game', () => {
    const game = seatedGame();
    game.startGame();
    playToTheEnd(game);

    const before = game.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot }));
    expect(game.returnToLobby()).toEqual({ ok: true });

    expect(game.phase).toBe('lobby');
    // The same four people, same seats, same bot flags.
    expect(game.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot }))).toEqual(
      before,
    );
    expect(game.players).toHaveLength(SEAT_COUNT);

    // Nothing from the finished game is left lying around.
    expect(game.history).toEqual([]);
    expect(game.result).toBeNull();
    expect(game.log).toEqual([]);
    expect(game.handNumber).toBe(0);
    expect(game.roundNumber).toBe(1);
    expect(game.dealerStreak).toBe(0);
    expect(game.lastDiscard).toBeNull();
    expect(game.pendingKong).toBeNull();
    expect(game.waitingSeats()).toEqual([]);
    for (const p of game.players) {
      expect(p.score).toBe(0);
      expect(totalCount(p.concealed)).toBe(0);
      expect(p.melds).toEqual([]);
      expect(p.discards).toEqual([]);
      expect(p.flowers).toEqual([]);
      expect(p.passedWater).toBe(false);
    }
  });

  it('invalidates in-flight bot timers so no stale move lands', () => {
    const game = seatedGame();
    game.startGame();
    const midGame = game.epoch;
    playToTheEnd(game);
    game.returnToLobby();
    // The bot pump drops a queued move when the epoch has moved on.
    expect(game.epoch).toBeGreaterThan(midGame);
  });

  it('can start a fresh game from the lobby afterwards', () => {
    const game = seatedGame();
    game.startGame();
    playToTheEnd(game);
    game.returnToLobby();

    game.startGame();
    expect(game.phase).toBe('acting');
    expect(game.handNumber).toBe(1);
    for (const p of game.players) expect(p.score).toBe(0);
  });
});

describe('starting another game straight off a finished one', () => {
  it('resets the scoreboard and deals a new hand without a lobby detour', () => {
    const game = seatedGame();
    game.startGame();
    playToTheEnd(game);
    expect(game.phase).toBe('gameOver');
    expect(game.players.some((p) => p.score !== 0)).toBe(true);

    game.startGame();

    expect(game.phase).toBe('acting');
    expect(game.handNumber).toBe(1);
    expect(game.roundNumber).toBe(1);
    expect(game.dealerSeat).toBe(0);
    expect(game.history).toEqual([]);
    for (const p of game.players) expect(p.score).toBe(0);
    // A full 16-tile deal, plus the dealer's opening 17th.
    const sizes = game.players.map((p) => totalCount(p.concealed) + p.melds.length * 3);
    expect(sizes.filter((n) => n === 17)).toHaveLength(1);
  });
});
