import {
  discardOptions,
  isHonor,
  isTerminal,
  shanten,
  type AvailableAction,
  type Counts,
  type Tile,
} from '@mahjong/shared';
import type { Game } from './game.js';

export type BotMove =
  | { kind: 'act'; actionId: string }
  | { kind: 'discard'; tile: Tile };

/** Best shanten reachable after discarding one tile from `counts`. */
function shantenAfterBestDiscard(counts: Counts, meldCount: number): number {
  const options = discardOptions(counts, meldCount);
  if (options.length === 0) return shanten(counts, meldCount);
  return options[0]!.shanten;
}

/**
 * Would taking this call leave the hand closer to a win than passing?
 *
 * A call adds a set and then owes a discard, so the comparison is between the
 * current 16-tile shanten and the best shanten reachable after calling and
 * throwing something away.
 */
function callImproves(
  concealed: Counts,
  meldCount: number,
  action: AvailableAction,
): boolean {
  const before = shanten(concealed, meldCount);
  const after = [...concealed];

  switch (action.type) {
    case 'pung':
      after[action.tile!]! -= 2;
      break;
    case 'kong':
      after[action.tile!]! -= 3;
      break;
    case 'chow':
      for (const t of action.uses ?? []) after[t]!--;
      break;
    default:
      return false;
  }

  return shantenAfterBestDiscard(after, meldCount + 1) < before;
}

/** A concealed or added kong is worth taking only if it does not set the hand back. */
function kongIsSafe(concealed: Counts, meldCount: number, action: AvailableAction): boolean {
  const tile = action.tile!;
  const before = shanten(concealed, meldCount);
  const after = [...concealed];
  after[tile]! -= action.type === 'concealedKong' ? 4 : 1;
  return shanten(after, meldCount + 1) <= before;
}

/**
 * Rank a discard. `discardOptions` already sorts by resulting shanten and then
 * by how many tiles would improve the hand; this only breaks remaining ties,
 * preferring to shed honors and terminals the way a cautious player would.
 */
function discardTiebreak(tile: Tile): number {
  if (isHonor(tile)) return 0;
  if (isTerminal(tile)) return 1;
  return 2;
}

/**
 * Decide what a bot does with its pending decision.
 *
 * Returns null when the bot has nothing to answer. Bots always take an
 * available win, so they never end up 過水.
 */
export function chooseBotMove(game: Game, seat: number): BotMove | null {
  const decision = game.decisionFor(seat);
  if (!decision) return null;

  const player = game.players[seat];
  if (!player) return null;
  const meldCount = player.melds.length;

  const win = decision.actions.find((a) => a.type === 'win' || a.type === 'flowerWin');
  if (win) return { kind: 'act', actionId: win.id };

  if (decision.reason === 'claim' || decision.reason === 'robbing') {
    const calls = decision.actions.filter(
      (a) => a.type === 'pung' || a.type === 'kong' || a.type === 'chow',
    );
    // Prefer a kong, then a pung, then a chow, among calls that actually help.
    const ranked = calls
      .filter((a) => callImproves(player.concealed, meldCount, a))
      .sort((a, b) => {
        const order = { kong: 0, pung: 1, chow: 2 } as Record<string, number>;
        return (order[a.type] ?? 3) - (order[b.type] ?? 3);
      });
    if (ranked.length > 0) return { kind: 'act', actionId: ranked[0]!.id };

    const pass = decision.actions.find((a) => a.type === 'pass');
    return pass ? { kind: 'act', actionId: pass.id } : null;
  }

  // Own turn: consider a kong, otherwise throw the best tile.
  const kong = decision.actions.find(
    (a) => a.type === 'concealedKong' || a.type === 'addedKong',
  );
  if (kong && kongIsSafe(player.concealed, meldCount, kong)) {
    return { kind: 'act', actionId: kong.id };
  }

  if (!decision.canDiscard) return null;

  const options = discardOptions(player.concealed, meldCount).filter((o) =>
    decision.discardable.includes(o.tile),
  );
  if (options.length === 0) {
    const fallback = decision.discardable[0];
    return fallback === undefined ? null : { kind: 'discard', tile: fallback };
  }

  const best = options[0]!;
  const tied = options.filter(
    (o) => o.shanten === best.shanten && o.improvers.length === best.improvers.length,
  );
  tied.sort((a, b) => discardTiebreak(a.tile) - discardTiebreak(b.tile));

  return { kind: 'discard', tile: tied[0]!.tile };
}

/** Bots pause briefly so a human can follow what happened. */
export function botDelay(reason: string): number {
  const base = reason === 'claim' || reason === 'robbing' ? 500 : 750;
  return base + Math.floor(Math.random() * 500);
}
