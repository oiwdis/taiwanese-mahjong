import type { RulesConfig } from './config.js';
import type { Meld } from './meld.js';
import type { ScoredHand, PaymentLine } from './scoring.js';
import type { Tile } from './tiles.js';

export type Seat = 0 | 1 | 2 | 3;

export const SEAT_COUNT = 4;

/** Turn order is counterclockwise, which is seat index ascending. */
export function nextSeat(seat: number): number {
  return (seat + 1) % SEAT_COUNT;
}

/** Distance from `from` to `to` following turn order. */
export function seatDistance(from: number, to: number): number {
  return (to - from + SEAT_COUNT) % SEAT_COUNT;
}

export const WIND_NAMES = ['East', 'South', 'West', 'North'] as const;
export const WIND_CHINESE = ['東', '南', '西', '北'] as const;

export type GamePhase =
  | 'lobby'
  | 'dealing'
  /** Current player has drawn and must act. */
  | 'acting'
  /** A tile was discarded and others may claim it. */
  | 'claiming'
  /** An added kong is exposed and others may rob it. */
  | 'robbing'
  | 'handOver'
  | 'gameOver';

export type ActionType =
  | 'discard'
  | 'chow'
  | 'pung'
  | 'kong'
  | 'concealedKong'
  | 'addedKong'
  | 'win'
  | 'flowerWin'
  | 'pass';

/**
 * One concretely executable choice.
 *
 * Nothing in this game is ever performed on a player's behalf. Every chow,
 * pung, kong and win is an explicit decision, and each distinct way of making
 * a call is its own action with its own `id`. Holding 3456p when 5p is
 * discarded produces three separate chow actions (345p, 456p, 567p) rather
 * than one that the server disambiguates by guessing.
 *
 * Clients execute a choice by echoing back `id`, so the server never has to
 * infer intent.
 */
export interface AvailableAction {
  id: string;
  type: ActionType;
  /** The tile being claimed, or the tile the kong is made of. */
  tile?: Tile;
  /** For a chow, the lowest tile of the run that would be formed. */
  chowLow?: Tile;
  /** Tiles taken out of your concealed hand to make the set. */
  uses?: Tile[];
  /** What the hand would score, shown on win actions before you commit. */
  taiPreview?: number;
  /** Short label for the button, e.g. "Chi 3-4-5p". */
  label: string;
  /**
   * True on a `pass` action that gives up a win, which arms 過水 and locks you
   * out of winning until you pass a hand. The client confirms before sending.
   */
  armsPassedWater?: boolean;
}

/** Why the server is waiting on this player. */
export type DecisionReason =
  /** You drew and must act: discard, declare a kong, or declare a self-draw. */
  | 'turn'
  /**
   * You just called a chow, pung or open kong and owe a discard. You cannot
   * win off the tile you just claimed into a set.
   */
  | 'postCall'
  /** Someone discarded and you may claim it. */
  | 'claim'
  /** Someone added to a pung and you may rob the kong. */
  | 'robbing';

export interface PendingDecision {
  reason: DecisionReason;
  /** Every call available to you, always including an explicit `pass`. */
  actions: AvailableAction[];
  /** True when you are also allowed to throw a tile. */
  canDiscard: boolean;
  /** Tiles you may legally throw. Empty when `canDiscard` is false. */
  discardable: Tile[];
  /**
   * True when you could win right now, so choosing to discard instead is a
   * deliberate decline that arms 過水. The client warns before discarding.
   */
  decliningWinArmsPassedWater: boolean;
  /** Epoch ms after which the server auto-passes, or null when untimed. */
  deadline: number | null;
}

export interface PublicPlayer {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  /** Money relative to the start of the session. */
  score: number;
  /** How many concealed tiles they hold, since the tiles are hidden. */
  concealedCount: number;
  melds: Meld[];
  flowers: Tile[];
  discards: Tile[];
  seatWind: number;
  isDealer: boolean;
  /** 過水: cannot declare a win until they pass a hand. */
  passedWater: boolean;
  /** True while the server is waiting for this player to choose. */
  thinking: boolean;
  /** True after they press Next hand (or are a bot / dropped seat). */
  readyForNext: boolean;
}

export interface HandResult {
  kind: 'win' | 'draw';
  winnerSeat: number | null;
  discarderSeat: number | null;
  winningTile: Tile | null;
  /** The winner's concealed tiles, revealed once the hand is over. */
  revealedConcealed: Tile[];
  scored: ScoredHand | null;
  lines: PaymentLine[];
  deltas: number[];
  summary: string;
  dealerContinues: boolean;
}

/**
 * The slice of state one player may see. The server holds the authoritative
 * state and renders one of these per player, so a client never receives
 * another player's concealed tiles.
 */
export interface PlayerView {
  roomCode: string;
  phase: GamePhase;
  rules: RulesConfig;
  hostSeat: number | null;

  /** Your seat, or null while spectating. */
  you: number | null;
  players: PublicPlayer[];

  /** Your concealed tiles, sorted. */
  hand: Tile[];
  /** The tile you just drew, kept separate so the UI can highlight it. */
  drawnTile: Tile | null;

  roundWind: number;
  /** 1-based index of the current 圈. */
  roundNumber: number;
  handNumber: number;
  dealerSeat: number;
  dealerStreak: number;

  currentSeat: number;
  /** Tiles that can still be drawn from either end of the wall. */
  wallRemaining: number;
  /** Draws left before the hand is declared drawn. */
  liveWallRemaining: number;

  lastDiscard: { seat: number; tile: Tile } | null;
  /** The kong being exposed during a robbing window. */
  pendingKong: { seat: number; tile: Tile } | null;

  /** Your pending choice, or null when it is not your decision. */
  decision: PendingDecision | null;
  /** Seats the server is still waiting on. */
  waitingOn: number[];

  /** Hints computed server-side from your own hand only. */
  analysis: {
    shanten: number;
    waits: Tile[];
    /** Copies of each wait still unseen from your perspective. */
    waitCounts: Record<number, number>;
  } | null;

  result: HandResult | null;
  log: string[];
}
