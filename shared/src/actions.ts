import type { RulesConfig } from './config.js';
import { MELDS_REQUIRED, completesHand, isWinningShape } from './hand.js';
import type { Meld } from './meld.js';
import { meetsMinimum, scoreHand, type WinContext } from './scoring.js';
import { seatDistance, type ActionType, type AvailableAction } from './state.js';
import {
  NUM_FLOWERS,
  FLOWER_START,
  canStartRun,
  cornerLabelOf,
  englishNameOf,
  type Counts,
  type Tile,
} from './tiles.js';

/**
 * Everything the action builders need to know about one player's position.
 * Kept separate from the server's mutable state so this stays pure.
 */
export interface PlayerSnapshot {
  seat: number;
  concealed: Counts;
  melds: Meld[];
  flowers: Tile[];
  seatWind: number;
  passedWater: boolean;
}

export interface WinCheckContext {
  roundWind: number;
  dealerSeat: number;
  dealerStreak: number;
  rules: RulesConfig;
  robbingKong?: boolean;
  kongReplacement?: boolean;
  lastDiscard?: boolean;
  lastDraw?: boolean;
}

function chowLabel(low: Tile): string {
  return `Chow ${cornerLabelOf(low)}-${cornerLabelOf(low + 1)}-${cornerLabelOf(low + 2)}`;
}

/**
 * Score a prospective win so the player can see what they are choosing
 * between. Returns null when the hand is not actually complete or falls below
 * the table minimum.
 */
export function previewWin(
  player: PlayerSnapshot,
  winningTile: Tile,
  selfDraw: boolean,
  ctx: WinCheckContext,
): number | null {
  const concealed = [...player.concealed];
  if (!selfDraw) concealed[winningTile]++;

  const meldsNeeded = MELDS_REQUIRED - player.melds.length;
  if (!isWinningShape(concealed, meldsNeeded)) return null;

  const winCtx: WinContext = {
    concealed,
    melds: player.melds,
    flowers: player.flowers,
    winningTile,
    selfDraw,
    seatWind: player.seatWind,
    roundWind: ctx.roundWind,
    isDealer: player.seat === ctx.dealerSeat,
    dealerStreak: ctx.dealerStreak,
    robbingKong: ctx.robbingKong ?? false,
    kongReplacement: ctx.kongReplacement ?? false,
    lastDiscard: ctx.lastDiscard ?? false,
    lastDraw: ctx.lastDraw ?? false,
    flowerWin: false,
  };
  const scored = scoreHand(winCtx, ctx.rules);
  if (!meetsMinimum(scored, ctx.rules)) return null;
  return scored.handTai;
}

/** True when this player holds all eight bonus tiles (八仙過海). */
export function hasFlowerWin(player: PlayerSnapshot, rules: RulesConfig): boolean {
  return rules.useFlowers && player.flowers.length === NUM_FLOWERS;
}

// ---------------------------------------------------------------------------
// Claim actions (someone else discarded)
// ---------------------------------------------------------------------------

/**
 * Every call this player may make on `tile`, discarded by `fromSeat`.
 *
 * A pass action is always included, so declining is a recorded decision rather
 * than a timeout. When the pass gives up a win it is flagged, because that is
 * what arms 過水.
 */
export function buildClaimActions(
  player: PlayerSnapshot,
  tile: Tile,
  fromSeat: number,
  ctx: WinCheckContext,
): AvailableAction[] {
  const actions: AvailableAction[] = [];
  const held = player.concealed[tile] ?? 0;
  let canWin = false;

  // 胡 — highest priority, and never automatic.
  if (!player.passedWater && completesHand(player.concealed, player.melds.length, tile)) {
    const tai = previewWin(player, tile, false, ctx);
    if (tai !== null) {
      canWin = true;
      actions.push({
        id: `win:${tile}`,
        type: 'win',
        tile,
        taiPreview: tai,
        label: `Win on ${englishNameOf(tile)} — ${tai} tai`,
      });
    }
  }

  // 槓 — an open kong needs three in hand.
  if (held >= 3) {
    actions.push({
      id: `kong:${tile}`,
      type: 'kong',
      tile,
      uses: [tile, tile, tile],
      label: `Kong ${cornerLabelOf(tile)}`,
    });
  }

  // 碰 — offered separately from the kong, so holding three copies is a choice.
  if (held >= 2) {
    actions.push({
      id: `pung:${tile}`,
      type: 'pung',
      tile,
      uses: [tile, tile],
      label: `Pung ${cornerLabelOf(tile)}`,
    });
  }

  // 吃 — only from the player to your left, which is the seat immediately
  // before yours in turn order.
  if (seatDistance(fromSeat, player.seat) === 1) {
    for (let low = tile - 2; low <= tile; low++) {
      if (low < 0 || !canStartRun(low)) continue;
      const needed = [low, low + 1, low + 2].filter((t) => t !== tile);
      if (needed.length !== 2) continue;
      const enough = needed.every((t, i) => {
        const duplicatesBefore = needed.slice(0, i).filter((u) => u === t).length;
        return (player.concealed[t] ?? 0) > duplicatesBefore;
      });
      if (!enough) continue;
      actions.push({
        id: `chow:${low}`,
        type: 'chow',
        tile,
        chowLow: low,
        uses: needed,
        label: chowLabel(low),
      });
    }
  }

  if (actions.length === 0) return [];

  actions.push({
    id: 'pass',
    type: 'pass',
    label: canWin ? 'Pass (gives up the win)' : 'Pass',
    armsPassedWater: canWin,
  });

  return actions;
}

// ---------------------------------------------------------------------------
// Robbing a kong (搶槓)
// ---------------------------------------------------------------------------

export function buildRobbingActions(
  player: PlayerSnapshot,
  tile: Tile,
  ctx: WinCheckContext,
): AvailableAction[] {
  if (player.passedWater) return [];
  if (!completesHand(player.concealed, player.melds.length, tile)) return [];
  const tai = previewWin(player, tile, false, { ...ctx, robbingKong: true });
  if (tai === null) return [];

  return [
    {
      id: `win:${tile}`,
      type: 'win',
      tile,
      taiPreview: tai,
      label: `Rob the kong on ${englishNameOf(tile)} — ${tai} tai`,
    },
    {
      id: 'pass',
      type: 'pass',
      label: 'Pass (gives up the win)',
      armsPassedWater: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Turn actions (you drew, or you owe a discard after calling)
// ---------------------------------------------------------------------------

export interface TurnActionArgs {
  player: PlayerSnapshot;
  /** The tile just drawn, when this decision follows a draw. */
  drawnTile: Tile | null;
  /** True when the draw was a kong or flower replacement (槓上開花). */
  kongReplacement: boolean;
  /** True when the wall is now empty (海底撈月). */
  lastDraw: boolean;
  /** False after calling a set, since you cannot win off the claimed tile. */
  allowWin: boolean;
  ctx: WinCheckContext;
}

/**
 * Kongs and self-draw wins available on your own turn. Discarding is handled
 * separately via `discardable`, since the natural gesture is clicking a tile.
 */
export function buildTurnActions(args: TurnActionArgs): AvailableAction[] {
  const { player, drawnTile, kongReplacement, lastDraw, allowWin, ctx } = args;
  const actions: AvailableAction[] = [];

  // 八仙過海 — still a declaration rather than something the server takes.
  if (hasFlowerWin(player, ctx.rules)) {
    actions.push({
      id: 'flowerWin',
      type: 'flowerWin',
      taiPreview: ctx.rules.taiScale === 'simplified' ? 4 : 8,
      label: 'Declare 八仙過海 (all eight flowers)',
    });
  }

  // 自摸 — only ever on an explicit declaration.
  if (allowWin && !player.passedWater && drawnTile !== null) {
    const meldsNeeded = MELDS_REQUIRED - player.melds.length;
    if (isWinningShape(player.concealed, meldsNeeded)) {
      const tai = previewWin(player, drawnTile, true, {
        ...ctx,
        kongReplacement,
        lastDraw,
      });
      if (tai !== null) {
        actions.push({
          id: `win:${drawnTile}`,
          type: 'win',
          tile: drawnTile,
          taiPreview: tai,
          label: `Self-draw on ${englishNameOf(drawnTile)} — ${tai} tai`,
        });
      }
    }
  }

  // 暗槓 — four concealed copies.
  for (let t = 0; t < player.concealed.length; t++) {
    if ((player.concealed[t] ?? 0) === 4) {
      actions.push({
        id: `concealedKong:${t}`,
        type: 'concealedKong',
        tile: t,
        uses: [t, t, t, t],
        label: `Concealed kong ${cornerLabelOf(t)}`,
      });
    }
  }

  // 加槓 — add the fourth tile to a pung already on the table.
  for (const meld of player.melds) {
    if (meld.kind !== 'pung') continue;
    if ((player.concealed[meld.tile] ?? 0) < 1) continue;
    actions.push({
      id: `addedKong:${meld.tile}`,
      type: 'addedKong',
      tile: meld.tile,
      uses: [meld.tile],
      label: `Add to pung — kong ${cornerLabelOf(meld.tile)}`,
    });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Priority resolution
// ---------------------------------------------------------------------------

export interface Declaration {
  seat: number;
  action: AvailableAction;
}

const PRIORITY: Record<ActionType, number> = {
  win: 3,
  flowerWin: 3,
  kong: 2,
  pung: 2,
  chow: 1,
  discard: 0,
  concealedKong: 0,
  addedKong: 0,
  pass: 0,
};

export function priorityOf(type: ActionType): number {
  return PRIORITY[type] ?? 0;
}

/**
 * Pick the winning claim once every eligible seat has answered.
 *
 * 胡 outranks 碰/槓, which outranks 吃. Between two players who both declared a
 * win, the one nearest the discarder in turn order takes it, since a single
 * discard produces a single winner unless the table enabled 一炮多響.
 */
export function resolveClaims(
  declarations: Declaration[],
  discarderSeat: number,
  rules: RulesConfig,
): { winning: Declaration[]; losing: Declaration[] } {
  const live = declarations.filter((d) => d.action.type !== 'pass');
  if (live.length === 0) return { winning: [], losing: [] };

  const topPriority = Math.max(...live.map((d) => priorityOf(d.action.type)));
  const contenders = live.filter((d) => priorityOf(d.action.type) === topPriority);

  const byNearest = [...contenders].sort(
    (a, b) => seatDistance(discarderSeat, a.seat) - seatDistance(discarderSeat, b.seat),
  );

  const isWin = topPriority === PRIORITY.win;
  const winning =
    isWin && rules.multipleWinnersPerDiscard ? byNearest : byNearest.slice(0, 1);

  const winningSeats = new Set(winning.map((d) => d.seat));
  return {
    winning,
    losing: live.filter((d) => !winningSeats.has(d.seat)),
  };
}

/**
 * Whether the server can stop waiting early. Safe only when no seat still to
 * answer could possibly outrank what has already been declared.
 */
export function canResolveEarly(
  declarations: Declaration[],
  pending: { seat: number; actions: AvailableAction[] }[],
): boolean {
  if (pending.length === 0) return true;
  const best = Math.max(0, ...declarations.map((d) => priorityOf(d.action.type)));
  if (best === 0) return false;
  const bestPossiblePending = Math.max(
    0,
    ...pending.flatMap((p) => p.actions.map((a) => priorityOf(a.type))),
  );
  return bestPossiblePending < best;
}

export { FLOWER_START };
