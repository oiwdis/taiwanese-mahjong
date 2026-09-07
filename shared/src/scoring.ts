import { taiTable, type RulesConfig } from './config.js';
import {
  MELDS_REQUIRED,
  enumerateDecompositions,
  waits,
  type Decomposition,
} from './hand.js';
import { isConcealedTriplet, isTripletMeld, type Meld } from './meld.js';
import { TAI_INFO, type TaiKey } from './tai.js';
import {
  DRAGON_START,
  PLANT_START,
  SEASON_START,
  WIND_START,
  countsFromTiles,
  isDragon,
  isHonor,
  isSuited,
  isWind,
  ownFlowersForSeat,
  totalCount,
  type Counts,
  type Tile,
} from './tiles.js';

export interface WinContext {
  /** Concealed tiles including the winning tile. */
  concealed: Counts;
  /** Sets already on the table, including concealed kongs. */
  melds: Meld[];
  /** Bonus tiles held in front of the winner. */
  flowers: Tile[];
  winningTile: Tile;
  selfDraw: boolean;
  /** 0..3 for E/S/W/N. */
  seatWind: number;
  roundWind: number;
  isDealer: boolean;
  /** Consecutive dealerships for the current dealer, before any cap. */
  dealerStreak: number;
  robbingKong: boolean;
  kongReplacement: boolean;
  /** Won on the final discard of the hand (河底撈魚). */
  lastDiscard: boolean;
  /** Self-drew the final live tile (海底撈月). */
  lastDraw: boolean;
  /** Won by collecting all eight bonus tiles. */
  flowerWin: boolean;
}

export interface TaiItem {
  key: TaiKey;
  chinese: string;
  english: string;
  /** Times the pattern was counted, e.g. two dragon pungs. */
  count: number;
  /** Value of a single instance. */
  each: number;
  /** count * each. */
  tai: number;
  note: string;
}

export interface ScoredHand {
  /** Tai from the hand itself, after caps. Excludes the dealership. */
  handTai: number;
  /** 2N+1 for the current dealership, after the streak cap. */
  dealershipTai: number;
  items: TaiItem[];
  dealershipItem: TaiItem | null;
  /** True when the cap in `rules.maxTai` reduced the total. */
  capped: boolean;
  /** Raw total before the cap. */
  rawHandTai: number;
}

interface Bucket {
  key: TaiKey;
  count: number;
}

/** Dealership value: 2N+1, where N is capped consecutive continuations. */
export function dealershipTaiFor(streak: number, rules: RulesConfig): number {
  const n = Math.max(0, Math.min(streak, rules.streakCap));
  return 2 * n + 1;
}

function pairIsHonor(dec: Decomposition): boolean {
  return isHonor(dec.pair);
}

/**
 * Score one reading of the hand. The caller tries every decomposition and
 * keeps the best, since a hand like 111222333m can be read as three triplets
 * or three runs and the two readings score differently.
 */
function scoreDecomposition(ctx: WinContext, dec: Decomposition, rules: RulesConfig): Bucket[] {
  const table = taiTable(rules);
  const buckets: Bucket[] = [];
  const add = (key: TaiKey, count = 1) => {
    if (count > 0 && (table[key] ?? 0) > 0) buckets.push({ key, count });
  };

  // Combine table sets with the concealed reading.
  const meldTriplets = ctx.melds.filter(isTripletMeld).map((m) => m.tile);
  const meldChows = ctx.melds.filter((m) => m.kind === 'chow').map((m) => m.tile);
  const triplets = [...meldTriplets, ...dec.pungs];
  const chows = [...meldChows, ...dec.chows];
  const allSetTiles = [...triplets, ...chows.flatMap((t) => [t, t + 1, t + 2])];
  const everyTile = [...allSetTiles, dec.pair];

  // --- Flower patterns -----------------------------------------------------
  const flowerSet = new Set(ctx.flowers);
  if (ctx.flowerWin) {
    // 八仙過海 is scored on its own, as a self-draw worth a flat 8 tai.
    add('eightFlowers');
    return buckets;
  }

  const [ownSeason, ownPlant] = ownFlowersForSeat(ctx.seatWind);
  let ownFlowerCount = 0;
  if (flowerSet.has(ownSeason)) ownFlowerCount++;
  if (flowerSet.has(ownPlant)) ownFlowerCount++;
  add('ownFlower', ownFlowerCount);

  let flowerSets = 0;
  if ([0, 1, 2, 3].every((i) => flowerSet.has(SEASON_START + i))) flowerSets++;
  if ([0, 1, 2, 3].every((i) => flowerSet.has(PLANT_START + i))) flowerSets++;
  add('flowerSet', flowerSets);

  // --- Concealment and how the tile arrived --------------------------------
  const isConcealedHand = ctx.melds.every((m) => m.kind === 'kong' && m.concealed);
  if (isConcealedHand && ctx.selfDraw) {
    add('concealedSelfDraw');
  } else {
    if (isConcealedHand) add('concealed');
    if (ctx.selfDraw) add('selfDraw');
  }

  if (ctx.robbingKong) add('robbingKong');
  if (ctx.kongReplacement) add('kongReplacement');
  if (ctx.lastDiscard) add('lastDiscard');
  if (ctx.lastDraw) add('lastDraw');

  // --- Honors --------------------------------------------------------------
  const dragonTriplets = triplets.filter(isDragon);
  const windTriplets = triplets.filter(isWind);

  const greatThreeDragons = dragonTriplets.length === 3;
  const smallThreeDragons =
    !greatThreeDragons && dragonTriplets.length === 2 && isDragon(dec.pair);
  if (greatThreeDragons) add('greatThreeDragons');
  else if (smallThreeDragons) add('smallThreeDragons');
  else add('dragonPung', dragonTriplets.length);

  const greatFourWinds = windTriplets.length === 4;
  const smallFourWinds = !greatFourWinds && windTriplets.length === 3 && isWind(dec.pair);
  if (greatFourWinds) {
    add('greatFourWinds');
  } else {
    if (smallFourWinds) add('smallFourWinds');
    // 小四喜 still adds the round/seat wind tai; 大四喜 suppresses them.
    const roundWindTile = WIND_START + ctx.roundWind;
    const seatWindTile = WIND_START + ctx.seatWind;
    add('roundWind', windTriplets.filter((t) => t === roundWindTile).length);
    add('seatWind', windTriplets.filter((t) => t === seatWindTile).length);
  }

  if (everyTile.every(isHonor)) add('allHonors');

  // --- Suit patterns -------------------------------------------------------
  const suits = new Set(everyTile.filter(isSuited).map((t) => Math.floor(t / 9)));
  const hasHonor = everyTile.some(isHonor);
  if (suits.size === 1 && !hasHonor) add('pureOneSuit');
  else if (suits.size === 1 && hasHonor) add('mixedOneSuit');

  // --- Set-shape patterns --------------------------------------------------
  if (chows.length === 0) add('allPungs');

  const concealedTripletCount =
    dec.pungs.length + ctx.melds.filter(isConcealedTriplet).length;
  if (concealedTripletCount >= 5) add('fiveConcealedPungs');
  else if (concealedTripletCount === 4) add('fourConcealedPungs');
  else if (concealedTripletCount === 3) add('threeConcealedPungs');

  // --- Wait shape ----------------------------------------------------------
  // Reconstruct the wait from the hand as it stood before the winning tile.
  const preWin = [...ctx.concealed];
  preWin[ctx.winningTile]--;
  const waitSet = waits(preWin, ctx.melds.length);
  if (waitSet.length === 1) add('singleWait');

  // 全求 / 半求: all five sets called, holding one tile that waits on the pair.
  const concealedBeforeWin = totalCount(preWin);
  if (ctx.melds.length === MELDS_REQUIRED && concealedBeforeWin === 1) {
    if (ctx.selfDraw) add('halfMelded');
    else add('allMelded');
  }

  // 平胡: the strict Taiwanese reading.
  const winCompletesChow = dec.chows.some(
    (low) =>
      ctx.winningTile === low || ctx.winningTile === low + 1 || ctx.winningTile === low + 2,
  );
  const winAtChowEnd = dec.chows.some(
    (low) => ctx.winningTile === low || ctx.winningTile === low + 2,
  );
  const allChows =
    !ctx.selfDraw &&
    ctx.flowers.length === 0 &&
    !hasHonor &&
    !pairIsHonor(dec) &&
    triplets.length === 0 &&
    winCompletesChow &&
    winAtChowEnd &&
    waitSet.length >= 2;
  if (allChows) add('allChows');

  return buckets;
}

function bucketsToItems(buckets: Bucket[], rules: RulesConfig): TaiItem[] {
  const table = taiTable(rules);
  const merged = new Map<TaiKey, number>();
  for (const b of buckets) merged.set(b.key, (merged.get(b.key) ?? 0) + b.count);

  const items: TaiItem[] = [];
  for (const [key, count] of merged) {
    const each = table[key] ?? 0;
    if (each <= 0 || count <= 0) continue;
    const info = TAI_INFO[key];
    items.push({
      key,
      chinese: info.chinese,
      english: info.english,
      count,
      each,
      tai: each * count,
      note: info.note,
    });
  }
  items.sort((a, b) => b.tai - a.tai || a.key.localeCompare(b.key));
  return items;
}

function totalOf(items: TaiItem[]): number {
  return items.reduce((sum, i) => sum + i.tai, 0);
}

/**
 * Score a completed hand. Tries every valid reading of the concealed tiles and
 * returns the highest-scoring one.
 */
export function scoreHand(ctx: WinContext, rules: RulesConfig): ScoredHand {
  const meldsNeeded = MELDS_REQUIRED - ctx.melds.length;
  const decompositions = ctx.flowerWin
    ? []
    : enumerateDecompositions(ctx.concealed, meldsNeeded);

  let bestItems: TaiItem[] = [];
  let bestTotal = -1;

  const candidates: Decomposition[] = decompositions.length
    ? decompositions
    : [{ pair: ctx.winningTile, chows: [], pungs: [] }];

  for (const dec of candidates) {
    let items = bucketsToItems(scoreDecomposition(ctx, dec, rules), rules);
    if (rules.pingHuStrict && items.length > 1) {
      items = items.filter((i) => i.key !== 'allChows');
    }
    const total = totalOf(items);
    if (total > bestTotal) {
      bestTotal = total;
      bestItems = items;
    }
  }

  const rawHandTai = Math.max(0, bestTotal);
  const capped = rules.maxTai > 0 && rawHandTai > rules.maxTai;
  const handTai = capped ? rules.maxTai : rawHandTai;

  const dealershipTai = dealershipTaiFor(ctx.dealerStreak, rules);
  const streakInfo = TAI_INFO.dealerStreak;
  const dealerInfo = TAI_INFO.dealer;
  const usingStreak = Math.min(ctx.dealerStreak, rules.streakCap) > 0;
  const dealershipItem: TaiItem = {
    key: usingStreak ? 'dealerStreak' : 'dealer',
    chinese: usingStreak ? streakInfo.chinese : dealerInfo.chinese,
    english: usingStreak
      ? `${streakInfo.english} (${Math.min(ctx.dealerStreak, rules.streakCap)})`
      : dealerInfo.english,
    count: 1,
    each: dealershipTai,
    tai: dealershipTai,
    note: usingStreak ? streakInfo.note : dealerInfo.note,
  };

  return {
    handTai,
    dealershipTai,
    items: bestItems,
    dealershipItem,
    capped,
    rawHandTai,
  };
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export interface PaymentLine {
  from: number;
  to: number;
  tai: number;
  amount: number;
  /** The dealership tai were folded into this line. */
  includesDealership: boolean;
}

export interface Settlement {
  /** Net money change per seat, indexed by seat. */
  deltas: number[];
  lines: PaymentLine[];
}

export interface SettleArgs {
  winnerSeat: number;
  /** Seat that supplied the winning tile, or null for a self-draw. */
  discarderSeat: number | null;
  dealerSeat: number;
  handTai: number;
  dealershipTai: number;
  rules: RulesConfig;
}

/**
 * Who pays what.
 *
 * A discard win is paid by the discarder alone; a self-draw is paid by all
 * three opponents. The dealership tai ride along only on the payment between
 * the winner and the dealer, so a non-dealer winning off another non-dealer
 * collects nothing extra from the dealer.
 */
export function settle(args: SettleArgs): Settlement {
  const { winnerSeat, discarderSeat, dealerSeat, handTai, dealershipTai, rules } = args;
  const deltas = [0, 0, 0, 0];
  const lines: PaymentLine[] = [];

  const payers =
    discarderSeat === null
      ? [0, 1, 2, 3].filter((s) => s !== winnerSeat)
      : [discarderSeat];

  for (const payer of payers) {
    const includesDealership = winnerSeat === dealerSeat || payer === dealerSeat;
    const tai = handTai + (includesDealership ? dealershipTai : 0);
    const amount = rules.base + tai * rules.taiValue;
    deltas[payer] -= amount;
    deltas[winnerSeat] += amount;
    lines.push({ from: payer, to: winnerSeat, tai, amount, includesDealership });
  }

  return { deltas, lines };
}

/**
 * Whether a win may be declared, enforcing the table minimum. The dealership
 * tai do not count toward the minimum, since they are positional rather than
 * something the hand achieved.
 */
export function meetsMinimum(scored: ScoredHand, rules: RulesConfig): boolean {
  return scored.handTai >= rules.minTai;
}

/** Convenience helper for tests and bots. */
export function scoreTilesForTest(
  tiles: Tile[],
  melds: Meld[],
  winningTile: Tile,
  overrides: Partial<WinContext>,
  rules: RulesConfig,
): ScoredHand {
  const ctx: WinContext = {
    concealed: countsFromTiles(tiles),
    melds,
    flowers: [],
    winningTile,
    selfDraw: false,
    seatWind: 0,
    roundWind: 0,
    isDealer: false,
    dealerStreak: 0,
    robbingKong: false,
    kongReplacement: false,
    lastDiscard: false,
    lastDraw: false,
    flowerWin: false,
    ...overrides,
  };
  return scoreHand(ctx, rules);
}

export { DRAGON_START };
