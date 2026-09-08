import {
  DEFAULT_RULES,
  NUM_KINDS,
  MELDS_REQUIRED,
  SEAT_COUNT,
  WIND_NAMES,
  Wall,
  parseTiles,
  buildClaimActions,
  buildRobbingActions,
  buildTurnActions,
  canResolveEarly,
  completesHand,
  countsFromTiles,
  cornerLabelOf,
  dealershipTaiFor,
  emptyCounts,
  englishNameOf,
  hasFlowerWin,
  isFlower,
  isWinningShape,
  meetsMinimum,
  nextSeat,
  randomSeed,
  resolveClaims,
  scoreHand,
  seatDistance,
  settle,
  shanten,
  tilesFromCounts,
  totalCount,
  waits,
  type AvailableAction,
  type Counts,
  type Declaration,
  type DecisionReason,
  type GamePhase,
  type HandResult,
  type Meld,
  type PlayerSnapshot,
  type PlayerView,
  type PublicPlayer,
  type RulesConfig,
  type Tile,
  type WinCheckContext,
  type WinContext,
} from '@mahjong/shared';

export interface PlayerState {
  seat: number;
  name: string;
  isBot: boolean;
  token: string;
  connected: boolean;
  score: number;
  concealed: Counts;
  melds: Meld[];
  flowers: Tile[];
  discards: Tile[];
  /** 過水: locked out of winning until a hand is passed. */
  passedWater: boolean;
  /**
   * Set when this player drew a tile they could not win on while passed
   * water. Their next discard clears the lock.
   */
  clearPassedWaterOnDiscard: boolean;
  /** Acknowledged the hand summary. */
  readyForNext: boolean;
}

interface Decision {
  seat: number;
  reason: DecisionReason;
  actions: AvailableAction[];
  canDiscard: boolean;
  discardable: Tile[];
  decliningWinArmsPassedWater: boolean;
}

export interface GameOptions {
  rules?: Partial<RulesConfig>;
  seed?: number;
}

/**
 * Authoritative state for one table.
 *
 * The engine never performs a chow, pung, kong or win on a player's behalf.
 * Whenever a choice exists it records a pending decision and waits; play only
 * advances when every seat the server is waiting on has answered. That is what
 * makes 過水 reachable, since declining a win has to be a real decision
 * somebody made rather than a timeout or an inference.
 */
export class Game {
  rules: RulesConfig;
  players: PlayerState[] = [];
  phase: GamePhase = 'lobby';

  private wall: Wall | null = null;
  private seed: number;

  roundWind = 0;
  roundNumber = 1;
  handNumber = 0;
  dealerSeat = 0;
  dealerStreak = 0;
  /** Dealerships seen in the current round, used to advance the round wind. */
  private dealershipsThisRound = 1;

  currentSeat = 0;
  drawnTile: Tile | null = null;
  private drawnWasReplacement = false;
  /** True once the final live tile has been drawn (海底 / 河底 window). */
  private isFinalTurn = false;

  lastDiscard: { seat: number; tile: Tile } | null = null;
  pendingKong: { seat: number; tile: Tile } | null = null;

  private decisions = new Map<number, Decision>();
  private declarations = new Map<number, AvailableAction>();

  result: HandResult | null = null;
  /** Every finished hand this session, oldest first. */
  history: HandResult[] = [];
  log: string[] = [];

  /** Bumped whenever the pending decisions change, to invalidate bot timers. */
  epoch = 0;

  constructor(options: GameOptions = {}) {
    this.rules = { ...DEFAULT_RULES, ...options.rules };
    this.seed = options.seed ?? randomSeed();
  }

  // -------------------------------------------------------------------------
  // Seats
  // -------------------------------------------------------------------------

  addPlayer(name: string, token: string, isBot: boolean): PlayerState | null {
    if (this.players.length >= SEAT_COUNT) return null;
    const seat = this.players.length;
    const player: PlayerState = {
      seat,
      name,
      isBot,
      token,
      connected: !isBot,
      score: 0,
      concealed: emptyCounts(),
      melds: [],
      flowers: [],
      discards: [],
      passedWater: false,
      clearPassedWaterOnDiscard: false,
      readyForNext: false,
    };
    this.players.push(player);
    return player;
  }

  removePlayer(seat: number): void {
    if (this.phase !== 'lobby') return;
    this.players.splice(seat, 1);
    this.players.forEach((p, i) => {
      p.seat = i;
    });
  }

  playerByToken(token: string): PlayerState | undefined {
    return this.players.find((p) => p.token === token);
  }

  seatWindOf(seat: number): number {
    return seatDistance(this.dealerSeat, seat);
  }

  private snapshot(player: PlayerState): PlayerSnapshot {
    return {
      seat: player.seat,
      concealed: player.concealed,
      melds: player.melds,
      flowers: player.flowers,
      seatWind: this.seatWindOf(player.seat),
      passedWater: player.passedWater,
    };
  }

  private winCtx(extra: Partial<WinCheckContext> = {}): WinCheckContext {
    return {
      roundWind: this.roundWind,
      dealerSeat: this.dealerSeat,
      dealerStreak: this.dealerStreak,
      rules: this.rules,
      ...extra,
    };
  }

  // -------------------------------------------------------------------------
  // Hand lifecycle
  // -------------------------------------------------------------------------

  startGame(): void {
    if (this.players.length !== SEAT_COUNT) throw new Error('Need four players');
    this.phase = 'dealing';
    this.roundWind = 0;
    this.roundNumber = 1;
    this.handNumber = 0;
    this.dealerSeat = 0;
    this.dealerStreak = 0;
    this.dealershipsThisRound = 1;
    for (const p of this.players) p.score = 0;
    this.log = [];
    this.history = [];
    this.startHand();
  }

  /**
   * Send a finished table back to the lobby with everyone still seated.
   *
   * Seats, names and bots survive so the same group can change the rules and
   * play again. Everything belonging to the finished game is cleared, and
   * `clearDecisions` bumps the epoch so any bot timer still in flight from the
   * last hand is discarded rather than acting on an empty table.
   */
  returnToLobby(): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'gameOver') {
      return { ok: false, error: 'The game is still going' };
    }

    this.phase = 'lobby';
    this.clearDecisions();
    this.declarations.clear();

    this.wall = null;
    this.result = null;
    this.history = [];
    this.log = [];

    this.roundWind = 0;
    this.roundNumber = 1;
    this.handNumber = 0;
    this.dealerSeat = 0;
    this.dealerStreak = 0;
    this.dealershipsThisRound = 1;

    this.currentSeat = 0;
    this.drawnTile = null;
    this.drawnWasReplacement = false;
    this.isFinalTurn = false;
    this.lastDiscard = null;
    this.pendingKong = null;

    for (const p of this.players) {
      p.score = 0;
      p.concealed = emptyCounts();
      p.melds = [];
      p.flowers = [];
      p.discards = [];
      p.passedWater = false;
      p.clearPassedWaterOnDiscard = false;
      p.readyForNext = false;
    }

    return { ok: true };
  }

  private startHand(): void {
    this.handNumber++;
    this.phase = 'dealing';
    this.result = null;
    this.decisions.clear();
    this.declarations.clear();
    this.lastDiscard = null;
    this.pendingKong = null;
    this.drawnTile = null;
    this.drawnWasReplacement = false;
    this.isFinalTurn = false;

    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.wall = Wall.create(this.rules.useFlowers, this.seed);

    for (const p of this.players) {
      p.concealed = emptyCounts();
      p.melds = [];
      p.flowers = [];
      p.discards = [];
      p.passedWater = false;
      p.clearPassedWaterOnDiscard = false;
      p.readyForNext = false;
    }

    // Sixteen each, dealt from the dealer counterclockwise. Flowers are set
    // aside and replaced as they appear (補花).
    for (let round = 0; round < 16; round++) {
      for (let i = 0; i < SEAT_COUNT; i++) {
        const seat = (this.dealerSeat + i) % SEAT_COUNT;
        this.intoHand(this.players[seat]!, this.wall.draw());
      }
    }

    // 開門: the dealer takes a seventeenth tile.
    this.currentSeat = this.dealerSeat;
    const opening = this.intoHand(this.players[this.dealerSeat]!, this.wall.draw());
    this.drawnTile = opening.tile;
    this.drawnWasReplacement = opening.replacedFlower;

    this.pushLog(
      `Hand ${this.handNumber} — ${WIND_NAMES[this.roundWind]} round, ` +
        `${this.players[this.dealerSeat]!.name} is dealer` +
        (this.dealerStreak > 0 ? ` (streak ${this.dealerStreak})` : ''),
    );

    this.phase = 'acting';
    this.beginTurnDecision(this.dealerSeat, { allowWin: true });
  }

  /**
   * Take a tile into a hand.
   *
   * Flower tiles never join the concealed hand: they are laid out in front of
   * the player and replaced from the tail of the wall (補花), repeating when a
   * replacement is itself a flower. `concealed` is a count vector over the 34
   * meldable kinds only, so a flower must never be written into it.
   *
   * Returns the tile that actually landed in the hand — null if the wall ran
   * dry mid-replacement — and whether any flower was set aside, since winning
   * on a flower replacement scores 槓上開花.
   */
  private intoHand(
    player: PlayerState,
    drawn: Tile,
  ): { tile: Tile | null; replacedFlower: boolean } {
    let current = drawn;
    let replacedFlower = false;

    while (isFlower(current)) {
      player.flowers.push(current);
      player.flowers.sort((a, b) => a - b);
      replacedFlower = true;
      if (!this.wall || this.wall.isEmpty) return { tile: null, replacedFlower };
      current = this.wall.drawReplacement();
    }

    player.concealed[current]!++;
    return { tile: current, replacedFlower };
  }

  /**
   * Replace the current hand with a scripted position.
   *
   * Not reachable through the socket protocol. It exists so tests and bug
   * reports can start from an exact position instead of hunting for a seed
   * that happens to produce one.
   */
  loadPosition(position: {
    /** Concealed tiles per seat in shorthand, e.g. '123m 456m 789m 234p 56p 55s'. */
    hands: string[];
    melds?: Meld[][];
    flowers?: Tile[][];
    discards?: Tile[][];
    passedWater?: boolean[];
    dealerSeat?: number;
    roundWind?: number;
    dealerStreak?: number;
    /** Tiles the next draws will produce, head first. */
    upcoming?: Tile[];
    /** Seat whose decision it is. Its hand should include the drawn tile. */
    toAct: number;
    /** The tile that seat just drew, highlighted and eligible for a self-draw. */
    drawn?: Tile;
  }): void {
    this.dealerSeat = position.dealerSeat ?? 0;
    this.roundWind = position.roundWind ?? 0;
    this.dealerStreak = position.dealerStreak ?? 0;
    this.result = null;

    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      const player = this.players[seat]!;
      player.concealed = countsFromTiles(parseTiles(position.hands[seat] ?? ''));
      player.melds = position.melds?.[seat] ?? [];
      player.flowers = position.flowers?.[seat] ?? [];
      player.discards = position.discards?.[seat] ?? [];
      player.passedWater = position.passedWater?.[seat] ?? false;
      player.clearPassedWaterOnDiscard = false;
      player.readyForNext = false;
    }

    // Pad past the dead-wall threshold so draws keep working. The padding
    // cycles through the kinds rather than repeating one, so it cannot hand
    // somebody a surprise kong.
    const upcoming = position.upcoming ?? [];
    const padding: Tile[] = [];
    while (upcoming.length + padding.length < this.rules.wallDeadTiles + 24) {
      padding.push(padding.length % NUM_KINDS);
    }
    this.wall = new Wall([...upcoming, ...padding]);

    this.lastDiscard = null;
    this.pendingKong = null;
    this.isFinalTurn = false;
    this.drawnTile = position.drawn ?? null;
    this.drawnWasReplacement = false;
    this.currentSeat = position.toAct;
    this.phase = 'acting';
    this.beginTurnDecision(position.toAct, { allowWin: true });
  }

  // -------------------------------------------------------------------------
  // Decisions
  // -------------------------------------------------------------------------

  private setDecision(decision: Decision): void {
    this.decisions.set(decision.seat, decision);
    this.epoch++;
  }

  private clearDecisions(): void {
    this.decisions.clear();
    this.declarations.clear();
    this.epoch++;
  }

  /** Seats the server is currently waiting on. */
  waitingSeats(): number[] {
    return [...this.decisions.keys()].filter((s) => !this.declarations.has(s));
  }

  decisionFor(seat: number): Decision | undefined {
    if (this.declarations.has(seat)) return undefined;
    return this.decisions.get(seat);
  }

  /**
   * Offer the acting player their options. Discarding is always allowed here;
   * a win or kong is only ever taken on an explicit declaration.
   */
  private beginTurnDecision(
    seat: number,
    opts: { allowWin: boolean; kongReplacement?: boolean; postCall?: boolean },
  ): void {
    this.clearDecisions();
    this.currentSeat = seat;
    this.phase = 'acting';
    const player = this.players[seat]!;

    const actions = buildTurnActions({
      player: this.snapshot(player),
      drawnTile: this.drawnTile,
      kongReplacement: opts.kongReplacement ?? false,
      lastDraw: this.isFinalTurn && !this.drawnWasReplacement,
      allowWin: opts.allowWin,
      ctx: this.winCtx(),
    });

    const hasWin = actions.some((a) => a.type === 'win' || a.type === 'flowerWin');

    this.setDecision({
      seat,
      reason: opts.postCall ? 'postCall' : 'turn',
      actions,
      canDiscard: true,
      discardable: tilesFromCounts(player.concealed),
      decliningWinArmsPassedWater: hasWin,
    });
  }

  /** Open the window in which the other three may claim a discard. */
  private openClaimWindow(discarderSeat: number, tile: Tile): void {
    this.clearDecisions();
    this.phase = 'claiming';

    let any = false;
    for (let i = 1; i < SEAT_COUNT; i++) {
      const seat = (discarderSeat + i) % SEAT_COUNT;
      const player = this.players[seat]!;
      const actions = buildClaimActions(
        this.snapshot(player),
        tile,
        discarderSeat,
        this.winCtx({ lastDiscard: this.isFinalTurn }),
      );
      if (actions.length === 0) continue;
      any = true;
      this.setDecision({
        seat,
        reason: 'claim',
        actions,
        canDiscard: false,
        discardable: [],
        decliningWinArmsPassedWater: false,
      });
    }

    if (!any) this.advanceTurn(discarderSeat);
  }

  /** Open the window in which a waiting player may rob an added kong. */
  private openRobbingWindow(kongSeat: number, tile: Tile): void {
    this.clearDecisions();
    this.phase = 'robbing';
    this.pendingKong = { seat: kongSeat, tile };

    let any = false;
    for (let i = 1; i < SEAT_COUNT; i++) {
      const seat = (kongSeat + i) % SEAT_COUNT;
      const player = this.players[seat]!;
      const actions = buildRobbingActions(this.snapshot(player), tile, this.winCtx());
      if (actions.length === 0) continue;
      any = true;
      this.setDecision({
        seat,
        reason: 'robbing',
        actions,
        canDiscard: false,
        discardable: [],
        decliningWinArmsPassedWater: false,
      });
    }

    if (!any) this.completeAddedKong(kongSeat, tile);
  }

  // -------------------------------------------------------------------------
  // Player entry points
  // -------------------------------------------------------------------------

  /** Execute exactly the offered choice with this id. */
  act(seat: number, actionId: string): { ok: true } | { ok: false; error: string } {
    const decision = this.decisionFor(seat);
    if (!decision) return { ok: false, error: 'Not your decision right now' };
    const action = decision.actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, error: 'That choice is not available' };

    if (decision.reason === 'claim' || decision.reason === 'robbing') {
      this.declarations.set(seat, action);
      this.epoch++;
      this.maybeResolveWindow();
      return { ok: true };
    }

    // Single-player decisions execute immediately.
    switch (action.type) {
      case 'win':
        this.declareSelfDrawWin(seat, action.tile!);
        return { ok: true };
      case 'flowerWin':
        this.declareFlowerWin(seat);
        return { ok: true };
      case 'concealedKong':
        this.doConcealedKong(seat, action.tile!);
        return { ok: true };
      case 'addedKong':
        this.doAddedKong(seat, action.tile!);
        return { ok: true };
      default:
        return { ok: false, error: 'Unsupported action' };
    }
  }

  discard(seat: number, tile: Tile): { ok: true } | { ok: false; error: string } {
    const decision = this.decisionFor(seat);
    if (!decision || !decision.canDiscard) {
      return { ok: false, error: 'You cannot discard right now' };
    }
    const player = this.players[seat]!;
    if ((player.concealed[tile] ?? 0) <= 0) {
      return { ok: false, error: 'You do not hold that tile' };
    }

    // Throwing a tile while a win was on offer is a deliberate decline, which
    // is exactly what arms 過水.
    if (decision.decliningWinArmsPassedWater) {
      player.passedWater = true;
      player.clearPassedWaterOnDiscard = false;
      this.pushLog(`${player.name} passed on a win and is now 過水`);
    } else if (player.clearPassedWaterOnDiscard) {
      player.passedWater = false;
      player.clearPassedWaterOnDiscard = false;
      this.pushLog(`${player.name} passed a hand and is no longer 過水`);
    }

    player.concealed[tile]!--;
    player.discards.push(tile);
    this.drawnTile = null;
    this.drawnWasReplacement = false;
    this.lastDiscard = { seat, tile };
    this.pushLog(`${player.name} discarded ${cornerLabelOf(tile)}`);

    this.openClaimWindow(seat, tile);
    return { ok: true };
  }

  readyForNextHand(seat: number): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'handOver') return { ok: false, error: 'No hand to advance' };
    this.players[seat]!.readyForNext = true;
    this.maybeAdvanceHand();
    return { ok: true };
  }

  /** A dropped seat must not hold the table on the Next-hand prompt. */
  markDisconnected(seat: number): void {
    const player = this.players[seat];
    if (!player) return;
    player.connected = false;
    if (this.phase === 'handOver') this.readyForNextHand(seat);
  }

  // -------------------------------------------------------------------------
  // Window resolution
  // -------------------------------------------------------------------------

  private maybeResolveWindow(): void {
    const pending = this.waitingSeats().map((seat) => ({
      seat,
      actions: this.decisions.get(seat)!.actions,
    }));
    const declarations: Declaration[] = [...this.declarations.entries()].map(
      ([seat, action]) => ({ seat, action }),
    );

    if (pending.length > 0 && !canResolveEarly(declarations, pending)) return;

    if (this.phase === 'robbing') this.resolveRobbingWindow(declarations);
    else this.resolveClaimWindow(declarations);
  }

  private resolveClaimWindow(declarations: Declaration[]): void {
    const discarderSeat = this.lastDiscard!.seat;
    const tile = this.lastDiscard!.tile;
    const { winning } = resolveClaims(declarations, discarderSeat, this.rules);

    // Only an explicit pass arms 過水. Losing a priority contest does not.
    for (const { seat, action } of declarations) {
      if (action.type === 'pass' && action.armsPassedWater) {
        const player = this.players[seat]!;
        player.passedWater = true;
        player.clearPassedWaterOnDiscard = false;
        this.pushLog(`${player.name} passed on a win and is now 過水`);
      }
    }

    if (winning.length === 0) {
      this.clearDecisions();
      this.advanceTurn(discarderSeat);
      return;
    }

    const top = winning[0]!;
    if (top.action.type === 'win') {
      this.clearDecisions();
      this.declareDiscardWin(top.seat, discarderSeat, tile, { robbingKong: false });
      return;
    }

    // The claimed tile leaves the discarder's river and joins the set.
    const discarder = this.players[discarderSeat]!;
    const idx = discarder.discards.lastIndexOf(tile);
    if (idx >= 0) discarder.discards.splice(idx, 1);
    this.lastDiscard = null;
    this.clearDecisions();

    const claimer = this.players[top.seat]!;
    switch (top.action.type) {
      case 'chow': {
        const low = top.action.chowLow!;
        for (const t of top.action.uses!) claimer.concealed[t]!--;
        claimer.melds.push({
          kind: 'chow',
          tile: low,
          concealed: false,
          fromSeat: discarderSeat,
          claimedTile: tile,
        });
        this.pushLog(`${claimer.name} called chi on ${cornerLabelOf(tile)}`);
        this.beginTurnDecision(top.seat, { allowWin: false, postCall: true });
        return;
      }
      case 'pung': {
        claimer.concealed[tile]! -= 2;
        claimer.melds.push({
          kind: 'pung',
          tile,
          concealed: false,
          fromSeat: discarderSeat,
          claimedTile: tile,
        });
        this.pushLog(`${claimer.name} called pong on ${cornerLabelOf(tile)}`);
        this.beginTurnDecision(top.seat, { allowWin: false, postCall: true });
        return;
      }
      case 'kong': {
        // 大明槓 while already waiting arms 過水.
        const wasWaiting = shanten(claimer.concealed, claimer.melds.length) === 0;
        claimer.concealed[tile]! -= 3;
        claimer.melds.push({
          kind: 'kong',
          tile,
          concealed: false,
          fromSeat: discarderSeat,
          claimedTile: tile,
        });
        if (wasWaiting) {
          claimer.passedWater = true;
          this.pushLog(`${claimer.name} ganged while waiting and is now 過水`);
        }
        this.pushLog(`${claimer.name} called gang on ${cornerLabelOf(tile)}`);
        this.drawReplacementFor(top.seat);
        return;
      }
      default:
        this.advanceTurn(discarderSeat);
    }
  }

  private resolveRobbingWindow(declarations: Declaration[]): void {
    const kong = this.pendingKong!;
    const { winning } = resolveClaims(declarations, kong.seat, this.rules);

    for (const { seat, action } of declarations) {
      if (action.type === 'pass' && action.armsPassedWater) {
        const player = this.players[seat]!;
        player.passedWater = true;
        player.clearPassedWaterOnDiscard = false;
        this.pushLog(`${player.name} declined to rob the gang and is now 過水`);
      }
    }

    this.clearDecisions();

    if (winning.length > 0 && winning[0]!.action.type === 'win') {
      const robber = winning[0]!.seat;
      this.pushLog(`${this.players[robber]!.name} robbed the gang`);
      this.declareDiscardWin(robber, kong.seat, kong.tile, { robbingKong: true });
      return;
    }

    this.completeAddedKong(kong.seat, kong.tile);
  }

  // -------------------------------------------------------------------------
  // Kongs
  // -------------------------------------------------------------------------

  private doConcealedKong(seat: number, tile: Tile): void {
    const player = this.players[seat]!;
    player.concealed[tile]! -= 4;
    player.melds.push({ kind: 'kong', tile, concealed: true });
    this.pushLog(`${player.name} declared a concealed gang`);
    this.clearDecisions();
    this.drawReplacementFor(seat);
  }

  private doAddedKong(seat: number, tile: Tile): void {
    const player = this.players[seat]!;
    player.concealed[tile]!--;
    if (this.rules.addedKongClearsPassedWater && player.passedWater) {
      player.clearPassedWaterOnDiscard = true;
    }
    this.pushLog(`${player.name} added to their pong of ${cornerLabelOf(tile)}`);
    this.openRobbingWindow(seat, tile);
  }

  private completeAddedKong(seat: number, tile: Tile): void {
    const player = this.players[seat]!;
    const meld = player.melds.find((m) => m.kind === 'pung' && m.tile === tile);
    if (meld) {
      meld.kind = 'kong';
      meld.wasAddedKong = true;
    }
    this.pendingKong = null;
    this.clearDecisions();
    this.drawReplacementFor(seat);
  }

  /** Draw from the tail of the wall after a kong, then hand back the turn. */
  private drawReplacementFor(seat: number): void {
    if (!this.wall || this.wall.isEmpty) {
      this.endHandDrawn();
      return;
    }
    const player = this.players[seat]!;
    const received = this.intoHand(player, this.wall.drawReplacement());
    if (received.tile === null) {
      this.endHandDrawn();
      return;
    }
    this.drawnTile = received.tile;
    this.drawnWasReplacement = true;
    this.currentSeat = seat;
    this.beginTurnDecision(seat, { allowWin: true, kongReplacement: true });
  }

  // -------------------------------------------------------------------------
  // Turn advance
  // -------------------------------------------------------------------------

  private advanceTurn(fromSeat: number): void {
    if (!this.wall) return;
    if (this.wall.remaining <= this.rules.wallDeadTiles) {
      this.endHandDrawn();
      return;
    }

    const seat = nextSeat(fromSeat);
    const player = this.players[seat]!;
    const received = this.intoHand(player, this.wall.draw());
    if (received.tile === null) {
      this.endHandDrawn();
      return;
    }
    this.drawnTile = received.tile;
    // A flower replacement counts as a kong replacement for 槓上開花.
    this.drawnWasReplacement = received.replacedFlower;

    if (this.wall.remaining <= this.rules.wallDeadTiles) this.isFinalTurn = true;

    // 過水 only clears after drawing a tile that could not have won.
    if (player.passedWater && this.drawnTile !== null) {
      const meldsNeeded = MELDS_REQUIRED - player.melds.length;
      const couldWin = isWinningShape(player.concealed, meldsNeeded);
      player.clearPassedWaterOnDiscard = !couldWin;
    }

    this.currentSeat = seat;
    this.beginTurnDecision(seat, {
      allowWin: true,
      kongReplacement: this.drawnWasReplacement,
    });
  }

  // -------------------------------------------------------------------------
  // Hand endings
  // -------------------------------------------------------------------------

  private declareSelfDrawWin(seat: number, winningTile: Tile): void {
    this.finishWin({
      winnerSeat: seat,
      discarderSeat: null,
      winningTile,
      selfDraw: true,
      robbingKong: false,
      kongReplacement: this.drawnWasReplacement,
      lastDiscard: false,
      lastDraw: this.isFinalTurn && !this.drawnWasReplacement,
      flowerWin: false,
    });
  }

  private declareDiscardWin(
    seat: number,
    discarderSeat: number,
    winningTile: Tile,
    opts: { robbingKong: boolean },
  ): void {
    const player = this.players[seat]!;
    player.concealed[winningTile]!++;
    this.finishWin({
      winnerSeat: seat,
      discarderSeat,
      winningTile,
      selfDraw: false,
      robbingKong: opts.robbingKong,
      kongReplacement: false,
      lastDiscard: this.isFinalTurn,
      lastDraw: false,
      flowerWin: false,
    });
  }

  private declareFlowerWin(seat: number): void {
    this.finishWin({
      winnerSeat: seat,
      discarderSeat: null,
      winningTile: this.players[seat]!.flowers[0] ?? 34,
      selfDraw: true,
      robbingKong: false,
      kongReplacement: false,
      lastDiscard: false,
      lastDraw: false,
      flowerWin: true,
    });
  }

  private finishWin(args: {
    winnerSeat: number;
    discarderSeat: number | null;
    winningTile: Tile;
    selfDraw: boolean;
    robbingKong: boolean;
    kongReplacement: boolean;
    lastDiscard: boolean;
    lastDraw: boolean;
    flowerWin: boolean;
  }): void {
    const winner = this.players[args.winnerSeat]!;
    const ctx: WinContext = {
      concealed: winner.concealed,
      melds: winner.melds,
      flowers: winner.flowers,
      winningTile: args.winningTile,
      selfDraw: args.selfDraw,
      seatWind: this.seatWindOf(args.winnerSeat),
      roundWind: this.roundWind,
      isDealer: args.winnerSeat === this.dealerSeat,
      dealerStreak: this.dealerStreak,
      robbingKong: args.robbingKong,
      kongReplacement: args.kongReplacement,
      lastDiscard: args.lastDiscard,
      lastDraw: args.lastDraw,
      flowerWin: args.flowerWin,
    };

    const scored = scoreHand(ctx, this.rules);
    const dealershipTai = dealershipTaiFor(this.dealerStreak, this.rules);
    const { deltas, lines } = settle({
      winnerSeat: args.winnerSeat,
      discarderSeat: args.discarderSeat,
      dealerSeat: this.dealerSeat,
      handTai: scored.handTai,
      dealershipTai,
      rules: this.rules,
    });

    this.players.forEach((p, i) => {
      p.score += deltas[i]!;
    });

    const how = args.flowerWin
      ? 'won with all eight flowers'
      : args.selfDraw
        ? `self-drew ${englishNameOf(args.winningTile)}`
        : `won on ${this.players[args.discarderSeat!]!.name}'s ${englishNameOf(args.winningTile)}`;

    const dealerContinues = args.winnerSeat === this.dealerSeat;

    this.result = {
      kind: 'win',
      winnerSeat: args.winnerSeat,
      discarderSeat: args.discarderSeat,
      winningTile: args.winningTile,
      revealedConcealed: tilesFromCounts(winner.concealed),
      scored,
      lines,
      deltas,
      summary: `${winner.name} ${how} for ${scored.handTai} tai`,
      dealerContinues,
    };

    this.history.push(this.result);
    this.pushLog(this.result.summary);
    this.phase = 'handOver';
    this.clearDecisions();
    this.markBotsReady();
    this.maybeAdvanceHand();
  }

  private endHandDrawn(): void {
    const dealerContinues = this.rules.drawContinuesDealer;
    this.result = {
      kind: 'draw',
      winnerSeat: null,
      discarderSeat: null,
      winningTile: null,
      revealedConcealed: [],
      scored: null,
      lines: [],
      deltas: [0, 0, 0, 0],
      summary: dealerContinues
        ? 'Drawn hand (流局) — the dealer keeps the deal'
        : 'Drawn hand (流局)',
      dealerContinues,
    };
    this.history.push(this.result);
    this.pushLog(this.result.summary);
    this.phase = 'handOver';
    this.clearDecisions();
    this.markBotsReady();
    this.maybeAdvanceHand();
  }

  private markBotsReady(): void {
    for (const p of this.players) {
      if (p.isBot || !p.connected) p.readyForNext = true;
      else p.readyForNext = false;
    }
  }

  private maybeAdvanceHand(): void {
    if (this.phase !== 'handOver' || !this.result) return;
    // Bots and dropped seats never need to press the button. A human who
    // disconnects after the summary appears used to leave everyone stuck.
    if (!this.players.every((p) => p.readyForNext || p.isBot || !p.connected)) return;

    const result = this.result;
    if (result.dealerContinues) {
      const advances = result.kind === 'win' || this.rules.drawAdvancesStreak;
      if (advances) this.dealerStreak++;
    } else {
      this.dealerSeat = nextSeat(this.dealerSeat);
      this.dealerStreak = 0;
      this.dealershipsThisRound++;
      if (this.dealershipsThisRound > SEAT_COUNT) {
        this.dealershipsThisRound = 1;
        this.roundNumber++;
        this.roundWind = (this.roundWind + 1) % SEAT_COUNT;
      }
    }

    if (this.roundNumber > this.rules.rounds) {
      this.phase = 'gameOver';
      this.pushLog('Game over');
      return;
    }

    if (this.rules.maxHandsPerGame > 0 && this.handNumber >= this.rules.maxHandsPerGame) {
      this.phase = 'gameOver';
      this.pushLog(
        `Game called after ${this.handNumber} hands — the round could not finish ` +
          `because the deal kept passing back to the dealer on drawn hands.`,
      );
      return;
    }

    this.startHand();
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  private pushLog(message: string): void {
    this.log.push(message);
    if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
  }

  /** Tiles this seat can account for, used to size the wait counts. */
  private visibleCount(seat: number, tile: Tile): number {
    let seen = this.players[seat]!.concealed[tile] ?? 0;
    for (const p of this.players) {
      seen += p.discards.filter((t) => t === tile).length;
      for (const m of p.melds) {
        if (m.kind === 'chow') {
          if (tile >= m.tile && tile <= m.tile + 2) seen++;
        } else if (m.tile === tile) {
          // Other seats' 暗槓 stay unknown, so they do not shrink wait counts.
          if (m.concealed && p.seat !== seat) continue;
          seen += m.kind === 'kong' ? 4 : 3;
        }
      }
    }
    return seen;
  }

  buildView(seat: number | null): PlayerView {
    const publicPlayers: PublicPlayer[] = this.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      isBot: p.isBot,
      connected: p.connected,
      score: p.score,
      concealedCount: totalCount(p.concealed),
      melds: p.melds.map((m) => {
        const showTile =
          p.seat === seat || this.phase === 'handOver' || this.phase === 'gameOver';
        if (m.concealed && !showTile) return { ...m, tile: -1 as Tile };
        return m;
      }),
      flowers: p.flowers,
      discards: p.discards,
      seatWind: this.seatWindOf(p.seat),
      isDealer: p.seat === this.dealerSeat,
      passedWater: p.passedWater,
      thinking: this.waitingSeats().includes(p.seat),
      readyForNext: p.readyForNext,
    }));

    const me = seat === null ? null : this.players[seat] ?? null;
    const decision = seat === null ? undefined : this.decisionFor(seat);

    let analysis: PlayerView['analysis'] = null;
    if (me && this.phase !== 'lobby' && this.phase !== 'gameOver') {
      const sh = shanten(me.concealed, me.melds.length);
      const w = waits(me.concealed, me.melds.length);
      const waitCounts: Record<number, number> = {};
      for (const t of w) waitCounts[t] = Math.max(0, 4 - this.visibleCount(me.seat, t));
      analysis = { shanten: sh, waits: w, waitCounts };
    }

    return {
      roomCode: '',
      phase: this.phase,
      rules: this.rules,
      hostSeat: this.players.length > 0 ? 0 : null,
      you: seat,
      players: publicPlayers,
      hand: me ? tilesFromCounts(me.concealed) : [],
      drawnTile: me && this.currentSeat === seat ? this.drawnTile : null,
      roundWind: this.roundWind,
      roundNumber: this.roundNumber,
      handNumber: this.handNumber,
      dealerSeat: this.dealerSeat,
      dealerStreak: this.dealerStreak,
      currentSeat: this.currentSeat,
      wallRemaining: this.wall?.remaining ?? 0,
      liveWallRemaining: Math.max(
        0,
        (this.wall?.remaining ?? 0) - this.rules.wallDeadTiles,
      ),
      lastDiscard: this.lastDiscard,
      pendingKong: this.pendingKong,
      decision: decision
        ? {
            reason: decision.reason,
            actions: decision.actions,
            canDiscard: decision.canDiscard,
            discardable: decision.discardable,
            decliningWinArmsPassedWater: decision.decliningWinArmsPassedWater,
            deadline: null,
          }
        : null,
      waitingOn: this.waitingSeats(),
      analysis,
      result: this.result,
      log: this.log.slice(-40),
    };
  }
}
