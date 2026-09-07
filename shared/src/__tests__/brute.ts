import { NUM_KINDS, type Counts, type Tile } from '../tiles.js';

/** Every set that can appear in a winning hand: 21 runs and 34 triplets. */
const MELD_TYPES: Tile[][] = (() => {
  const out: Tile[][] = [];
  for (let suit = 0; suit < 3; suit++) {
    for (let r = 0; r <= 6; r++) {
      const low = suit * 9 + r;
      out.push([low, low + 1, low + 2]);
    }
  }
  for (let t = 0; t < NUM_KINDS; t++) out.push([t, t, t]);
  return out;
})();

/**
 * Shanten straight from the definition, for cross-checking the fast version.
 *
 * A hand reaches a specific winning hand W by acquiring the tiles of W it is
 * missing; each turn supplies one and the last is the winning tile. So shanten
 * is the smallest `missing` over every possible W, minus one.
 *
 * `maxMissing` bounds the search: any branch that has already accumulated that
 * many missing tiles is abandoned, and the result saturates at `maxMissing - 1`.
 * Callers pass a bound derived from the value under test, which keeps the
 * search fast while still detecting a fast result that is too high (the oracle
 * finds something smaller) or too low (the oracle saturates).
 */
export function bruteShanten(
  hand: Counts,
  fixedMelds: Tile[][] = [],
  maxMissing = 12,
): number {
  const used = new Array<number>(NUM_KINDS).fill(0);
  let best = maxMissing;

  // Tiles sitting in a declared set are already owned, so fold them into the
  // hand before measuring what is missing.
  const owned = [...hand];
  for (const meld of fixedMelds) {
    for (const t of meld) owned[t] = (owned[t] ?? 0) + 1;
  }

  function apply(tiles: Tile[]): number | null {
    let delta = 0;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]!;
      if (used[t]! >= 4) {
        for (let j = i - 1; j >= 0; j--) used[tiles[j]!]!--;
        return null;
      }
      used[t]!++;
      if (used[t]! > owned[t]!) delta++;
    }
    return delta;
  }

  function revert(tiles: Tile[]): void {
    for (const t of tiles) used[t]!--;
  }

  for (const meld of fixedMelds) {
    if (apply(meld) === null) throw new Error('Illegal fixed meld');
  }
  const fixedMissing = 0;

  function choosePair(missing: number): void {
    for (let p = 0; p < NUM_KINDS; p++) {
      const delta = apply([p, p]);
      if (delta === null) continue;
      const total = missing + delta;
      if (total < best) best = total;
      revert([p, p]);
    }
  }

  function place(startIdx: number, meldsLeft: number, missing: number): void {
    if (missing >= best) return;
    if (meldsLeft === 0) {
      choosePair(missing);
      return;
    }
    for (let i = startIdx; i < MELD_TYPES.length; i++) {
      const meld = MELD_TYPES[i]!;
      const delta = apply(meld);
      if (delta === null) continue;
      place(i, meldsLeft - 1, missing + delta);
      revert(meld);
    }
  }

  place(0, 5 - fixedMelds.length, fixedMissing);
  return best - 1;
}
