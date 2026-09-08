import { sortTiles, type Tile } from '@mahjong/shared';

/** Insert `tile` after every tile that sorts at or before it. */
export function insertSorted(hand: readonly Tile[], tile: Tile): Tile[] {
  let i = hand.length;
  while (i > 0 && hand[i - 1]! > tile) i -= 1;
  const next = [...hand];
  next.splice(i, 0, tile);
  return next;
}

/** Identity of a dealt hand. Changing it resets the local tile order. */
export function dealKeyOf(view: {
  roomCode: string;
  you: number | null;
  roundWind: number;
  roundNumber: number;
  handNumber: number;
}): string {
  return `${view.roomCode}:${view.you}:${view.roundWind}:${view.roundNumber}:${view.handNumber}`;
}

export function sameMultiset(a: readonly Tile[], b: readonly Tile[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<Tile, number>();
  for (const tile of a) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  for (const tile of b) {
    const n = counts.get(tile);
    if (!n) return false;
    counts.set(tile, n - 1);
  }
  return true;
}

/**
 * Keep the player's arrangement. Tiles that left the hand drop out; newly
 * drawn tiles slot into sorted order so a pickup sits with its suit/rank.
 */
export function reconcileHand(previous: readonly Tile[], incoming: readonly Tile[]): Tile[] {
  if (previous.length === 0) return sortTiles([...incoming]);
  const remaining = [...incoming];
  const kept: Tile[] = [];
  for (const tile of previous) {
    const i = remaining.indexOf(tile);
    if (i >= 0) {
      kept.push(tile);
      remaining.splice(i, 1);
    }
  }
  remaining.sort((a, b) => a - b);
  let next = kept;
  for (const tile of remaining) {
    next = insertSorted(next, tile);
  }
  return next;
}

export function moveTile<T>(hand: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= hand.length ||
    to >= hand.length
  ) {
    return [...hand];
  }
  const next = [...hand];
  const [tile] = next.splice(from, 1);
  next.splice(to, 0, tile!);
  return next;
}
