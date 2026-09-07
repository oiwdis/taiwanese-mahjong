import type { TaiKey } from './tai.js';

/**
 * Table rules. Taiwanese mahjong is markedly less standardised than riichi, so
 * essentially everything a group would argue about before playing is a knob.
 */
export interface RulesConfig {
  /** Money: payout = base + tai * taiValue. Conventionally written "30/10". */
  base: number;
  taiValue: number;

  /** Play with the 8 bonus tiles (144 tiles) or without them (136 tiles). */
  useFlowers: boolean;

  /** Named tai scale. `custom` uses `taiOverrides` verbatim. */
  taiScale: 'traditional' | 'simplified' | 'custom';
  /** Per-pattern overrides applied on top of the chosen scale. */
  taiOverrides: Partial<Record<TaiKey, number>>;

  /** Hands below this tai total cannot be declared. 0 allows "屁胡" wins. */
  minTai: number;
  /** Cap on a hand's tai, excluding the dealership tai. 0 disables the cap. */
  maxTai: number;

  /** Consecutive dealerships beyond this stop adding tai. */
  streakCap: number;
  /** A drawn hand keeps the dealer (臭莊) and advances the streak. */
  drawContinuesDealer: boolean;
  /** A drawn hand counts toward 連莊 tai as well as keeping the seat. */
  drawAdvancesStreak: boolean;

  /** Tiles left in the wall when the hand is declared drawn. */
  wallDeadTiles: number;

  /** Number of 圈 to play. One 圈 is the dealership passing through all four. */
  rounds: number;

  /**
   * Hard stop on hands per game, as a stall guard. With `drawContinuesDealer`
   * on, the dealership does not pass on a draw, so a table with a high `minTai`
   * can draw hand after hand and never finish the round. 0 disables the guard.
   */
  maxHandsPerGame: number;

  /** 過水: an added kong (加槓) counts as the action that clears it. */
  addedKongClearsPassedWater: boolean;
  /** 過水: declining a chow/pung also arms it, not just declining a win. */
  passingCallsArmsPassedWater: boolean;

  /** 一炮多響 — let every eligible player win off a single discard. */
  multipleWinnersPerDiscard: boolean;

  /** 平胡 is void when the hand scores any other pattern. */
  pingHuStrict: boolean;

  /** Seconds a player has to act before the server auto-passes. 0 disables. */
  turnTimeoutSeconds: number;
}

export const TRADITIONAL_TAI: Record<TaiKey, number> = {
  dealer: 1,
  dealerStreak: 0, // computed as 2N, added to `dealer`
  selfDraw: 1,
  concealed: 1,
  concealedSelfDraw: 3,
  roundWind: 1,
  seatWind: 1,
  dragonPung: 1,
  ownFlower: 1,
  flowerSet: 2,
  eightFlowers: 8,
  singleWait: 1,
  robbingKong: 1,
  kongReplacement: 1,
  lastDiscard: 1,
  lastDraw: 1,
  allChows: 2,
  threeConcealedPungs: 2,
  fourConcealedPungs: 5,
  fiveConcealedPungs: 8,
  allMelded: 2,
  halfMelded: 1,
  allPungs: 4,
  mixedOneSuit: 4,
  pureOneSuit: 8,
  smallThreeDragons: 4,
  greatThreeDragons: 8,
  smallFourWinds: 8,
  greatFourWinds: 16,
  allHonors: 8,
};

/**
 * The lower scale used by many casual tables and most online platforms.
 */
export const SIMPLIFIED_TAI: Record<TaiKey, number> = {
  ...TRADITIONAL_TAI,
  allPungs: 4,
  mixedOneSuit: 3,
  pureOneSuit: 6,
  allChows: 1,
  fourConcealedPungs: 4,
  fiveConcealedPungs: 6,
  eightFlowers: 4,
  greatFourWinds: 8,
  allHonors: 6,
};

export const DEFAULT_RULES: RulesConfig = {
  base: 30,
  taiValue: 10,
  useFlowers: true,
  taiScale: 'traditional',
  taiOverrides: {},
  minTai: 0,
  maxTai: 0,
  streakCap: 10,
  drawContinuesDealer: true,
  drawAdvancesStreak: true,
  wallDeadTiles: 16,
  rounds: 1,
  maxHandsPerGame: 100,
  addedKongClearsPassedWater: true,
  passingCallsArmsPassedWater: false,
  multipleWinnersPerDiscard: false,
  pingHuStrict: false,
  turnTimeoutSeconds: 0,
};

/** Resolve the effective tai value table for a config. */
export function taiTable(rules: RulesConfig): Record<TaiKey, number> {
  const scale =
    rules.taiScale === 'simplified'
      ? SIMPLIFIED_TAI
      : rules.taiScale === 'custom'
        ? TRADITIONAL_TAI
        : TRADITIONAL_TAI;
  return { ...scale, ...rules.taiOverrides };
}

/** Clamp incoming lobby config to sane bounds so a client cannot break a game. */
export function sanitizeRules(input: Partial<RulesConfig>): RulesConfig {
  const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
    return Math.min(hi, Math.max(lo, n));
  };
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

  const overrides: Partial<Record<TaiKey, number>> = {};
  if (input.taiOverrides && typeof input.taiOverrides === 'object') {
    for (const [key, value] of Object.entries(input.taiOverrides)) {
      if (key in TRADITIONAL_TAI && typeof value === 'number' && Number.isFinite(value)) {
        overrides[key as TaiKey] = clampInt(value, 0, 200, 0);
      }
    }
  }

  return {
    base: clampInt(input.base, 0, 100000, DEFAULT_RULES.base),
    taiValue: clampInt(input.taiValue, 0, 100000, DEFAULT_RULES.taiValue),
    useFlowers: bool(input.useFlowers, DEFAULT_RULES.useFlowers),
    taiScale:
      input.taiScale === 'simplified' || input.taiScale === 'custom'
        ? input.taiScale
        : 'traditional',
    taiOverrides: overrides,
    minTai: clampInt(input.minTai, 0, 40, DEFAULT_RULES.minTai),
    maxTai: clampInt(input.maxTai, 0, 200, DEFAULT_RULES.maxTai),
    streakCap: clampInt(input.streakCap, 0, 50, DEFAULT_RULES.streakCap),
    drawContinuesDealer: bool(input.drawContinuesDealer, DEFAULT_RULES.drawContinuesDealer),
    drawAdvancesStreak: bool(input.drawAdvancesStreak, DEFAULT_RULES.drawAdvancesStreak),
    wallDeadTiles: clampInt(input.wallDeadTiles, 0, 32, DEFAULT_RULES.wallDeadTiles),
    rounds: clampInt(input.rounds, 1, 4, DEFAULT_RULES.rounds),
    maxHandsPerGame: clampInt(input.maxHandsPerGame, 0, 1000, DEFAULT_RULES.maxHandsPerGame),
    addedKongClearsPassedWater: bool(
      input.addedKongClearsPassedWater,
      DEFAULT_RULES.addedKongClearsPassedWater,
    ),
    passingCallsArmsPassedWater: bool(
      input.passingCallsArmsPassedWater,
      DEFAULT_RULES.passingCallsArmsPassedWater,
    ),
    multipleWinnersPerDiscard: bool(
      input.multipleWinnersPerDiscard,
      DEFAULT_RULES.multipleWinnersPerDiscard,
    ),
    pingHuStrict: bool(input.pingHuStrict, DEFAULT_RULES.pingHuStrict),
    turnTimeoutSeconds: clampInt(input.turnTimeoutSeconds, 0, 300, DEFAULT_RULES.turnTimeoutSeconds),
  };
}
