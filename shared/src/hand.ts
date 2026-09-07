import {
  NUM_KINDS,
  canStartRun,
  isAdjacentInSuit,
  isSuited,
  totalCount,
  type Counts,
  type Tile,
} from './tiles.js';
import type { Meld } from './meld.js';

/** A Taiwanese winning hand is five sets plus one pair. */
export const MELDS_REQUIRED = 5;
/** Tiles held between turns. */
export const HAND_SIZE = 16;
/** Tiles held at the moment of winning. */
export const WINNING_HAND_SIZE = 17;

/** Blocks a hand can be carved into: five sets plus the pair. */
const MAX_BLOCKS = MELDS_REQUIRED + 1;

/**
 * How many tiles of a kind a declared kong removes from the concealed count.
 * Kongs occupy a set slot but hold four tiles, so a hand with K kongs holds
 * HAND_SIZE + K tiles in total.
 */
export function concealedTileTarget(melds: readonly Meld[], winning: boolean): number {
  const setsUsed = melds.length;
  return (MELDS_REQUIRED - setsUsed) * 3 + (winning ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Exhaustive decomposition
// ---------------------------------------------------------------------------

interface MeldSplit {
  chows: Tile[];
  pungs: Tile[];
}

/**
 * Enumerate every way to carve `counts` into exactly `n` sets.
 *
 * The lowest remaining tile must belong to some set, so branching only on that
 * tile is exhaustive and generates each distinct decomposition once.
 */
function collectMelds(
  counts: Counts,
  n: number,
  chows: Tile[],
  pungs: Tile[],
  out: MeldSplit[],
): void {
  if (n === 0) {
    if (totalCount(counts) === 0) out.push({ chows: [...chows], pungs: [...pungs] });
    return;
  }

  let i = 0;
  while (i < NUM_KINDS && counts[i] === 0) i++;
  if (i === NUM_KINDS) return;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    pungs.push(i);
    collectMelds(counts, n - 1, chows, pungs, out);
    pungs.pop();
    counts[i] += 3;
  }

  if (canStartRun(i) && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    chows.push(i);
    collectMelds(counts, n - 1, chows, pungs, out);
    chows.pop();
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
  }
}

/** True when `counts` can be carved into exactly `n` sets. */
function canFormMelds(counts: Counts, n: number): boolean {
  if (n === 0) return totalCount(counts) === 0;

  let i = 0;
  while (i < NUM_KINDS && counts[i] === 0) i++;
  if (i === NUM_KINDS) return false;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    const ok = canFormMelds(counts, n - 1);
    counts[i] += 3;
    if (ok) return true;
  }

  if (canStartRun(i) && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    const ok = canFormMelds(counts, n - 1);
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
    if (ok) return true;
  }

  return false;
}

/**
 * True when the concealed tiles form exactly `meldsNeeded` sets plus one pair.
 * `meldsNeeded` is MELDS_REQUIRED minus the number of sets already on the table.
 */
export function isWinningShape(counts: Counts, meldsNeeded: number): boolean {
  if (meldsNeeded < 0) return false;
  if (totalCount(counts) !== meldsNeeded * 3 + 2) return false;

  const c = [...counts];
  for (let p = 0; p < NUM_KINDS; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    const ok = canFormMelds(c, meldsNeeded);
    c[p] += 2;
    if (ok) return true;
  }
  return false;
}

export interface Decomposition {
  pair: Tile;
  /** Lowest tile of each concealed run. */
  chows: Tile[];
  /** The repeated tile of each concealed triplet. */
  pungs: Tile[];
}

/** Every valid reading of a completed concealed portion. Usually one or two. */
export function enumerateDecompositions(counts: Counts, meldsNeeded: number): Decomposition[] {
  if (meldsNeeded < 0) return [];
  if (totalCount(counts) !== meldsNeeded * 3 + 2) return [];

  const c = [...counts];
  const out: Decomposition[] = [];
  for (let p = 0; p < NUM_KINDS; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    const splits: MeldSplit[] = [];
    collectMelds(c, meldsNeeded, [], [], splits);
    c[p] += 2;
    for (const s of splits) out.push({ pair: p, chows: s.chows, pungs: s.pungs });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shanten
// ---------------------------------------------------------------------------

interface ShantenSearch {
  best: number;
  openMelds: number;
}

function evaluate(
  melds: number,
  partials: number,
  hasPair: boolean,
  search: ShantenSearch,
): void {
  const totalMelds = search.openMelds + melds;
  let sh = 2 * MELDS_REQUIRED - 2 * totalMelds - partials;
  // Every block is spoken for but none of them can serve as the pair, so one
  // block has to be broken up first.
  if (totalMelds + partials === MAX_BLOCKS && !hasPair) sh += 1;
  if (sh < search.best) search.best = sh;
}

function searchBlocks(
  counts: Counts,
  i: number,
  melds: number,
  partials: number,
  hasPair: boolean,
  search: ShantenSearch,
): void {
  if (i >= NUM_KINDS) {
    evaluate(melds, partials, hasPair, search);
    return;
  }
  if (counts[i] === 0) {
    searchBlocks(counts, i + 1, melds, partials, hasPair, search);
    return;
  }

  const blocksUsed = search.openMelds + melds + partials;
  const canAddBlock = blocksUsed < MAX_BLOCKS;

  if (canAddBlock && counts[i] >= 3) {
    counts[i] -= 3;
    searchBlocks(counts, i, melds + 1, partials, hasPair, search);
    counts[i] += 3;
  }

  if (canAddBlock && canStartRun(i) && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    searchBlocks(counts, i, melds + 1, partials, hasPair, search);
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
  }

  if (canAddBlock && counts[i] >= 2) {
    counts[i] -= 2;
    searchBlocks(counts, i, melds, partials + 1, true, search);
    counts[i] += 2;
  }

  if (canAddBlock && isAdjacentInSuit(i) && counts[i + 1] > 0) {
    counts[i]--;
    counts[i + 1]--;
    searchBlocks(counts, i, melds, partials + 1, hasPair, search);
    counts[i]++;
    counts[i + 1]++;
  }

  if (canAddBlock && canStartRun(i) && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 2]--;
    searchBlocks(counts, i, melds, partials + 1, hasPair, search);
    counts[i]++;
    counts[i + 2]++;
  }

  // Leave this copy of the tile out of every block.
  counts[i]--;
  searchBlocks(counts, i, melds, partials, hasPair, search);
  counts[i]++;
}

/**
 * Straightforward whole-hand block search.
 *
 * Correct but slow, because it re-explores the same suit shapes over and over.
 * Kept as the reference implementation that `shanten` is tested against.
 */
export function shantenReference(counts: Counts, openMelds: number): number {
  const search: ShantenSearch = { best: Number.POSITIVE_INFINITY, openMelds };
  searchBlocks([...counts], 0, 0, 0, false, search);
  return search.best;
}

// --- Fast shanten, decomposed by suit ---------------------------------------
//
// Suits never interact: a run cannot cross from characters into dots, so how
// one suit is carved up has no bearing on another. That means each suit group
// can be reduced to the set of (sets, partial sets, has-a-pair) shapes it can
// produce, and those small tables can be combined. The tables are memoised by
// the group's tile counts, so a hand that shifts one tile reuses three of its
// four groups.

/** Widest useful block count in one group; the whole hand only needs six. */
const GROUP_DIM = MAX_BLOCKS + 1;

/**
 * Reachable shapes for one group, indexed by `melds * GROUP_DIM + partials`.
 * Bit 1 means reachable with no pair among the partials, bit 2 means reachable
 * with at least one pair, which is what can serve as the hand's eye.
 */
type GroupTable = Uint8Array;

const suitedMemo = new Map<number, GroupTable>();
const honorMemo = new Map<number, GroupTable>();

function groupKey(counts: Counts, start: number, size: number): number {
  let key = 0;
  for (let i = 0; i < size; i++) key = key * 5 + (counts[start + i] ?? 0);
  return key;
}

function enumerateGroup(counts: Counts, start: number, size: number, allowRuns: boolean): GroupTable {
  const table: GroupTable = new Uint8Array(GROUP_DIM * GROUP_DIM);
  const local = new Array<number>(size);
  for (let i = 0; i < size; i++) local[i] = counts[start + i] ?? 0;

  function rec(i: number, melds: number, partials: number, hasPair: boolean): void {
    if (i >= size) {
      table[melds * GROUP_DIM + partials]! |= hasPair ? 2 : 1;
      return;
    }
    if (local[i] === 0) {
      rec(i + 1, melds, partials, hasPair);
      return;
    }

    const canAddBlock = melds + partials < MAX_BLOCKS;

    if (canAddBlock && local[i]! >= 3) {
      local[i]! -= 3;
      rec(i, melds + 1, partials, hasPair);
      local[i]! += 3;
    }

    if (canAddBlock && allowRuns && i + 2 < size && local[i + 1]! > 0 && local[i + 2]! > 0) {
      local[i]!--;
      local[i + 1]!--;
      local[i + 2]!--;
      rec(i, melds + 1, partials, hasPair);
      local[i]!++;
      local[i + 1]!++;
      local[i + 2]!++;
    }

    if (canAddBlock && local[i]! >= 2) {
      local[i]! -= 2;
      rec(i, melds, partials + 1, true);
      local[i]! += 2;
    }

    if (canAddBlock && allowRuns && i + 1 < size && local[i + 1]! > 0) {
      local[i]!--;
      local[i + 1]!--;
      rec(i, melds, partials + 1, hasPair);
      local[i]!++;
      local[i + 1]!++;
    }

    if (canAddBlock && allowRuns && i + 2 < size && local[i + 2]! > 0) {
      local[i]!--;
      local[i + 2]!--;
      rec(i, melds, partials + 1, hasPair);
      local[i]!++;
      local[i + 2]!++;
    }

    local[i]!--;
    rec(i, melds, partials, hasPair);
    local[i]!++;
  }

  rec(0, 0, 0, false);
  return table;
}

function groupTable(counts: Counts, start: number, size: number, allowRuns: boolean): GroupTable {
  const memo = allowRuns ? suitedMemo : honorMemo;
  const key = groupKey(counts, start, size);
  let table = memo.get(key);
  if (!table) {
    table = enumerateGroup(counts, start, size, allowRuns);
    memo.set(key, table);
  }
  return table;
}

function combineGroups(a: GroupTable, b: GroupTable): GroupTable {
  const out: GroupTable = new Uint8Array(GROUP_DIM * GROUP_DIM);
  for (let m1 = 0; m1 < GROUP_DIM; m1++) {
    for (let p1 = 0; p1 + m1 < GROUP_DIM; p1++) {
      const f1 = a[m1 * GROUP_DIM + p1]!;
      if (f1 === 0) continue;
      for (let m2 = 0; m1 + m2 < GROUP_DIM; m2++) {
        for (let p2 = 0; p1 + p2 + m1 + m2 < GROUP_DIM; p2++) {
          const f2 = b[m2 * GROUP_DIM + p2]!;
          if (f2 === 0) continue;
          let flags = 0;
          // No pair anywhere requires both sides to manage without one.
          if (f1 & 1 && f2 & 1) flags |= 1;
          // A pair is available if either side can supply one while the other
          // is reachable at all.
          if ((f1 & 2 && f2 !== 0) || (f2 & 2 && f1 !== 0)) flags |= 2;
          out[(m1 + m2) * GROUP_DIM + (p1 + p2)]! |= flags;
        }
      }
    }
  }
  return out;
}

/**
 * Tiles still needed to reach a winning hand, minus one.
 *
 *   -1  already a winning hand
 *    0  tenpai (waiting on a tile)
 *    n  n tiles away from tenpai
 *
 * `openMelds` is the number of sets already on the table, which count as
 * complete and consume block slots.
 */
export function shanten(counts: Counts, openMelds: number): number {
  let table = groupTable(counts, 0, 9, true);
  table = combineGroups(table, groupTable(counts, 9, 9, true));
  table = combineGroups(table, groupTable(counts, 18, 9, true));
  table = combineGroups(table, groupTable(counts, 27, 7, false));

  let best = Number.POSITIVE_INFINITY;
  for (let melds = 0; melds < GROUP_DIM; melds++) {
    for (let partials = 0; partials < GROUP_DIM; partials++) {
      const flags = table[melds * GROUP_DIM + partials]!;
      if (flags === 0) continue;

      const totalMelds = openMelds + melds;
      const blocks = totalMelds + partials;
      if (blocks > MAX_BLOCKS) continue;

      const base = 2 * MELDS_REQUIRED - 2 * totalMelds - partials;
      if (flags & 2) {
        if (base < best) best = base;
      }
      if (flags & 1) {
        const withoutPair = blocks === MAX_BLOCKS ? base + 1 : base;
        if (withoutPair < best) best = withoutPair;
      }
    }
  }
  return best;
}

/** Convenience wrapper taking the melds themselves. */
export function shantenOfHand(counts: Counts, melds: readonly Meld[]): number {
  return shanten(counts, melds.length);
}

// ---------------------------------------------------------------------------
// Waits
// ---------------------------------------------------------------------------

/**
 * Every tile kind that would complete the hand right now. Empty unless the
 * concealed portion is exactly one tile short of a win.
 */
export function waits(counts: Counts, openMelds: number): Tile[] {
  const meldsNeeded = MELDS_REQUIRED - openMelds;
  if (meldsNeeded < 0) return [];
  if (totalCount(counts) !== meldsNeeded * 3 + 1) return [];

  const c = [...counts];
  const out: Tile[] = [];
  for (let t = 0; t < NUM_KINDS; t++) {
    if (c[t] >= 4) continue;
    c[t]++;
    if (isWinningShape(c, meldsNeeded)) out.push(t);
    c[t]--;
  }
  return out;
}

/** True when adding `tile` to the concealed portion completes the hand. */
export function completesHand(counts: Counts, openMelds: number, tile: Tile): boolean {
  const meldsNeeded = MELDS_REQUIRED - openMelds;
  if (meldsNeeded < 0) return false;
  if (totalCount(counts) !== meldsNeeded * 3 + 1) return false;
  const c = [...counts];
  c[tile]++;
  return isWinningShape(c, meldsNeeded);
}

/**
 * Discards that keep the hand at its best shanten, each with the waits or
 * improving tiles that follow. Used for the "what should I throw" hints and by
 * the bots.
 */
export interface DiscardOption {
  tile: Tile;
  shanten: number;
  /** Tiles that would improve the hand after this discard. */
  improvers: Tile[];
}

/**
 * Rank the legal discards.
 *
 * Resulting shanten is computed for every discard, but the `improvers` list is
 * only filled in for the discards tied at the best shanten, since working it
 * out costs another 34 shanten evaluations per candidate and only matters for
 * breaking ties. Pass `includeImprovers` to fill it in for all of them.
 */
export function discardOptions(
  counts: Counts,
  openMelds: number,
  options: { includeImprovers?: boolean } = {},
): DiscardOption[] {
  const c = [...counts];
  const out: DiscardOption[] = [];

  for (let t = 0; t < NUM_KINDS; t++) {
    if (c[t] === 0) continue;
    c[t]--;
    out.push({ tile: t, shanten: shanten(c, openMelds), improvers: [] });
    c[t]++;
  }

  if (out.length === 0) return out;

  const best = out.reduce((lo, o) => Math.min(lo, o.shanten), Number.POSITIVE_INFINITY);
  for (const option of out) {
    if (!options.includeImprovers && option.shanten !== best) continue;
    c[option.tile]--;
    for (let u = 0; u < NUM_KINDS; u++) {
      if (c[u] >= 4) continue;
      c[u]++;
      if (shanten(c, openMelds) < option.shanten) option.improvers.push(u);
      c[u]--;
    }
    c[option.tile]++;
  }

  out.sort((a, b) => a.shanten - b.shanten || b.improvers.length - a.improvers.length);
  return out;
}

/** Suits actually present among a hand's number tiles. */
export function suitsPresent(counts: Counts, melds: readonly Meld[]): Set<number> {
  const suits = new Set<number>();
  for (let t = 0; t < NUM_KINDS; t++) {
    if (counts[t] > 0 && isSuited(t)) suits.add(Math.floor(t / 9));
  }
  for (const m of melds) {
    if (isSuited(m.tile)) suits.add(Math.floor(m.tile / 9));
  }
  return suits;
}
