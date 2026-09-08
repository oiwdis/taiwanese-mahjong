import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WIND_CHINESE,
  WIND_NAMES,
  cornerLabelOf,
  englishNameOf,
  meldTiles,
  type AvailableAction,
  type PlayerView,
  type PublicPlayer,
  type Tile,
} from '@mahjong/shared';
import { api } from '../socket.js';
import { TileBack, TileFace } from './Tile.js';
import { ActionBar } from './ActionBar.js';
import { ClaimPopup } from './ClaimPopup.js';
import { HandSummary } from './HandSummary.js';
import { MyHand } from './MyHand.js';

type Confirm =
  | { kind: 'action'; action: AvailableAction }
  | { kind: 'discard'; tile: Tile };

/** Where a seat sits relative to you. You are always south. */
type Pos = 'south' | 'east' | 'north' | 'west';

const RING_SIDES: Pos[] = ['north', 'east', 'south', 'west'];

function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * The wall as it actually sits on the table: four sides of stacks, two high.
 *
 * A full Taiwanese set is 144 tiles, which is exactly 4 sides x 18 stacks x 2.
 * Dropping the flowers leaves 136, so the sides shorten to 17 stacks each
 * rather than leaving one side ragged.
 */
function WallRing({ view }: { view: PlayerView }) {
  const total = view.rules.useFlowers ? 144 : 136;
  const perSide = total / 8;
  const taken = total - view.wallRemaining;
  // Draws stop with `wallDeadTiles` still standing, so those are the tiles at
  // the far end of the ring that will never be reached (海底).
  const deadFrom = total - view.rules.wallDeadTiles;

  return (
    <div
      className="wall-ring"
      aria-hidden="true"
      // Sides divide their length by the stack count, so 18 (or 17) always
      // fits exactly however big the table is drawn.
      style={{ '--per-side': perSide } as React.CSSProperties}
    >
      {RING_SIDES.map((side, s) => (
        <div key={side} className={`wall-side wall-side-${side}`}>
          {Array.from({ length: perSide }, (_, i) => {
            const stack = s * perSide + i;
            // The top tile of a stack always leaves before the one beneath it.
            const upper = 2 * stack;
            const lower = upper + 1;
            return (
              <span key={i} className="wall-stack">
                <span
                  className={cls(
                    'wall-tile wall-tile-lower',
                    lower < taken && 'wall-tile-taken',
                    lower >= deadFrom && 'wall-tile-dead',
                  )}
                />
                <span
                  className={cls(
                    'wall-tile wall-tile-upper',
                    upper < taken && 'wall-tile-taken',
                    upper >= deadFrom && 'wall-tile-dead',
                  )}
                />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Melds({
  player,
  size = 'xs',
  revealConcealed = false,
}: {
  player: PublicPlayer;
  size?: 'xs' | 'sm';
  /** The owner may see which tile an 暗槓 is. Everyone else sees backs. */
  revealConcealed?: boolean;
}) {
  if (player.melds.length === 0 && player.flowers.length === 0) return null;
  return (
    <div className="melds">
      {player.melds.map((meld, i) => (
        <div key={i} className={`meld ${meld.concealed ? 'meld-concealed' : ''}`}>
          {meld.concealed && !revealConcealed
            ? [0, 1, 2, 3].map((j) => <TileBack key={j} size={size} />)
            : meldTiles(meld).map((t, j) =>
                meld.concealed && j > 0 && j < 3 ? (
                  <TileBack key={j} size={size} />
                ) : (
                  <TileFace key={j} tile={t} size={size} />
                ),
              )}
        </div>
      ))}
      {player.flowers.length > 0 && (
        <div className="meld meld-flowers">
          {player.flowers.map((t, i) => (
            <TileFace key={i} tile={t} size={size} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A player's discard pile, laid out on the felt in front of them.
 *
 * Each river sits just inside its owner's stretch of the wall, so a thrown
 * tile stays visibly attached to whoever threw it.
 */
function River({
  player,
  pos,
  lastDiscard,
  claimable,
}: {
  player: PublicPlayer;
  pos: Pos;
  lastDiscard: { seat: number; tile: Tile } | null;
  claimable: boolean;
}) {
  const lastIndex = player.discards.length - 1;
  return (
    <div className={`river river-${pos}`}>
      {player.discards.map((t, i) => {
        const isLast = i === lastIndex && lastDiscard?.seat === player.seat;
        return (
          <TileFace
            key={`${t}-${i}`}
            tile={t}
            size="xs"
            highlight={isLast}
            className={cls(
              isLast && 'river-fresh',
              isLast && claimable && 'river-claimable',
            )}
          />
        );
      })}
    </div>
  );
}

function SeatPlate({
  player,
  view,
  pos,
  self = false,
}: {
  player: PublicPlayer;
  view: PlayerView;
  pos: Pos;
  /** Your own plate: name and score only. The real hand lives in the tray. */
  self?: boolean;
}) {
  const isCurrent = view.currentSeat === player.seat;
  const isWaiting = view.waitingOn.includes(player.seat);

  return (
    <div
      className={cls(
        'seat-stack',
        `seat-stack-${pos}`,
        self && 'seat-stack-self',
        isCurrent && 'seat-current',
        isWaiting && 'seat-waiting',
      )}
    >
      <div className={cls('seat', `seat-${pos}`, self && 'seat-self')}>
        <div className="seat-header">
          <span className="seat-wind-badge">{WIND_CHINESE[player.seatWind]}</span>
          <span className="seat-name">
            {player.name}
            {self && ' (you)'}
          </span>
          {player.isDealer && <span className="tag dealer">莊</span>}
          {player.isBot && <span className="tag">bot</span>}
          {!player.isBot && !player.connected && <span className="tag warn">away</span>}
          {player.passedWater && (
            <span className="tag warn" title="過水 — cannot win until they pass a hand">
              過水
            </span>
          )}
          {isWaiting && <span className="tag thinking">thinking…</span>}
          <span className="seat-score">{player.score}</span>
        </div>
      </div>

      {!self && (
        <div className={cls('rack', `rack-${pos}`)}>
          {/* North/south run side to side; east/west run up and down, the way
              the tiles sit on a real table. */}
          <div className="rack-hand">
            {Array.from({ length: player.concealedCount }).map((_, i) => (
              <TileBack key={i} size="xs" />
            ))}
          </div>
          <Melds
            player={player}
            revealConcealed={view.phase === 'handOver' || view.phase === 'gameOver'}
          />
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: Confirm;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDiscard = confirm.kind === 'discard';
  return (
    <div className="modal-backdrop">
      <div className="modal modal-narrow">
        <h2>Give up the win?</h2>
        <p>
          {isDiscard ? (
            <>
              You can win this hand right now. Throwing{' '}
              <strong>{cornerLabelOf(confirm.tile)}</strong> instead declines it.
            </>
          ) : (
            <>You are choosing to pass on a winning tile.</>
          )}
        </p>
        <p className="confirm-rule">
          That puts you <strong>過水</strong>: you will not be able to win at all
          — not even on a self-draw — until you draw a tile you cannot win on and
          then discard. Passing is a real strategic option, since a self-draw
          collects from all three opponents instead of one, but it is a gamble.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-pass-warn" onClick={onConfirm}>
            Yes, give up the win
          </button>
        </div>
      </div>
    </div>
  );
}

/** A tile in mid-air, either being drawn from the wall or thrown into a river. */
interface Flight {
  key: number;
  kind: 'draw' | 'discard';
  pos: Pos;
  /** Face-up when we know the tile, face-down for an opponent's draw. */
  tile: Tile | null;
}

/** What we remember about the previous view, to diff the next one against. */
export interface MoveMemo {
  hand: number;
  wall: number;
  rivers: Map<number, number>;
}

export function memoOf(view: PlayerView): MoveMemo {
  return {
    hand: view.handNumber,
    wall: view.wallRemaining,
    rivers: new Map(view.players.map((p) => [p.seat, p.discards.length])),
  };
}

/**
 * Work out which tiles moved between two views.
 *
 * The server sends state, not move events, so a draw shows up as the wall
 * shrinking and a discard as somebody's river growing. Deriving it here keeps
 * the animation honest: it can only show a move the state actually made.
 */
export function movesBetween(
  before: MoveMemo | null,
  view: PlayerView,
  posOf: (seat: number) => Pos,
): Omit<Flight, 'key'>[] {
  // The opening deal moves a lot of tiles at once; do not animate it.
  if (!before || before.hand !== view.handNumber) return [];

  const moves: Omit<Flight, 'key'>[] = [];

  if (view.wallRemaining < before.wall) {
    moves.push({
      kind: 'draw',
      pos: posOf(view.currentSeat),
      // Only your own draw is face-up; you cannot see what others took.
      tile: view.currentSeat === view.you ? view.drawnTile : null,
    });
  }

  for (const player of view.players) {
    const had = before.rivers.get(player.seat) ?? 0;
    if (player.discards.length <= had) continue;
    const tile = player.discards[player.discards.length - 1];
    if (tile === undefined) continue;
    moves.push({ kind: 'discard', pos: posOf(player.seat), tile });
  }

  return moves;
}


/** Longest a tile can stay in the air before it is swept up regardless. */
const FLIGHT_TTL_MS = 1200;

function useFlights(
  view: PlayerView,
  posOf: (seat: number) => Pos,
): [Flight[], (key: number) => void] {
  const [flights, setFlights] = useState<Flight[]>([]);
  const prev = useRef<MoveMemo | null>(null);
  const nextKey = useRef(0);

  const remove = useCallback(
    (key: number) => setFlights((current) => current.filter((f) => f.key !== key)),
    [],
  );

  useEffect(() => {
    const before = prev.current;
    prev.current = memoOf(view);

    const next = movesBetween(before, view, posOf).map((move) => ({
      ...move,
      key: nextKey.current++,
    }));
    if (next.length === 0) return;
    setFlights((current) => [...current, ...next]);

    // `animationend` never fires if the animation does not run — reduced-motion
    // hides the layer entirely — so nothing may ever clean these up. Sweep them
    // on a timer so they cannot pile up.
    const keys = next.map((f) => f.key);
    const timer = setTimeout(
      () => setFlights((current) => current.filter((f) => !keys.includes(f.key))),
      FLIGHT_TTL_MS,
    );
    return () => clearTimeout(timer);
  }, [view, posOf]);

  return [flights, remove];
}

function FlightLayer({
  flights,
  onDone,
}: {
  flights: Flight[];
  onDone: (key: number) => void;
}) {
  return (
    <div className="flight-layer" aria-hidden="true">
      {flights.map((f) => (
        <div
          key={f.key}
          className={`flight flight-${f.kind} flight-${f.kind}-${f.pos}`}
          onAnimationEnd={() => onDone(f.key)}
        >
          {f.tile === null ? <TileBack size="sm" /> : <TileFace tile={f.tile} size="sm" />}
        </div>
      ))}
    </div>
  );
}

export function Table({ view, onExit }: { view: PlayerView; onExit?: () => void }) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reference = view.you ?? 0;
  const seatAt = (offset: number) => view.players[(reference + offset) % 4];
  const me = view.you !== null ? view.players[view.you] : undefined;
  const decision = view.decision;
  const isHost = view.you !== null && view.you === view.hostSeat;

  /** Run a table action and surface a rejection instead of failing quietly. */
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    const res = await action();
    if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
      setError('error' in res ? String(res.error) : 'That did not work.');
    }
  };

  const waitLabels = useMemo(() => {
    if (!view.analysis) return [];
    return view.analysis.waits.map((t) => ({
      tile: t,
      remaining: view.analysis!.waitCounts[t] ?? 0,
    }));
  }, [view.analysis]);

  const runAction = async (action: AvailableAction) => {
    setError(null);
    const res = await api.act(action.id);
    if ('ok' in res && res.ok === false) setError(res.error);
  };

  const onAct = (action: AvailableAction) => {
    if (action.armsPassedWater) {
      setConfirm({ kind: 'action', action });
      return;
    }
    void runAction(action);
  };

  const runDiscard = async (tile: Tile) => {
    setError(null);
    const res = await api.discard(tile);
    if ('ok' in res && res.ok === false) setError(res.error);
  };

  const onTileClick = (tile: Tile) => {
    if (!decision?.canDiscard) return;
    if (decision.decliningWinArmsPassedWater) {
      setConfirm({ kind: 'discard', tile });
      return;
    }
    void runDiscard(tile);
  };

  const resolveConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'action') void runAction(confirm.action);
    else void runDiscard(confirm.tile);
    setConfirm(null);
  };

  const north = seatAt(2);
  const east = seatAt(1);
  const west = seatAt(3);

  // You always sit south, so everyone else rotates around you.
  const posOf = useCallback(
    (seat: number): Pos =>
      (['south', 'east', 'north', 'west'] as const)[(seat - reference + 4) % 4]!,
    [reference],
  );

  const [flights, clearFlight] = useFlights(view, posOf);

  // A claim window is open: the table is deliberately holding while somebody
  // decides whether to take the discard.
  const claimOpen = view.phase === 'claiming' || view.phase === 'robbing';
  const myClaim = claimOpen && decision !== null && decision.reason !== 'turn';
  const claimPopup =
    decision !== null && (decision.reason === 'claim' || decision.reason === 'robbing');
  const claimNames = view.waitingOn
    .filter((s) => s !== view.you)
    .map((s) => view.players[s]?.name)
    .filter(Boolean);

  return (
    <div className="table-screen">
      <header className="game-header">
        <div className="header-block">
          <span className="header-label">Round</span>
          <span className="header-value">
            {WIND_NAMES[view.roundWind]} {view.roundNumber}/{view.rules.rounds}
          </span>
        </div>
        <div className="header-block">
          <span className="header-label">Hand</span>
          <span className="header-value">{view.handNumber}</span>
        </div>
        <div className="header-block">
          <span className="header-label">Dealer</span>
          <span className="header-value">
            {view.players[view.dealerSeat]?.name}
            {view.dealerStreak > 0 && (
              <span className="streak"> 連{view.dealerStreak} · {2 * view.dealerStreak + 1}台</span>
            )}
          </span>
        </div>
        <div className="header-block">
          <span className="header-label">Wall</span>
          <span className="header-value">
            {view.liveWallRemaining}
            <span className="header-sub"> draws left</span>
          </span>
        </div>
        <div className="header-block">
          <span className="header-label">Stakes</span>
          <span className="header-value">
            {view.rules.base}/{view.rules.taiValue}
          </span>
        </div>
        <div className="header-block header-code">
          <span className="header-label">Table</span>
          <span className="header-value">{view.roomCode}</span>
        </div>
        {onExit && (
          <button type="button" className="btn btn-tiny exit-game" onClick={onExit}>
            Exit game
          </button>
        )}
      </header>

      <div className="table-felt">
        <div className={cls('round-table', claimOpen && 'round-table-claiming')}>
          <div className="felt-circle" />
          <WallRing view={view} />

          {view.players.map((p) => (
            <River
              key={p.seat}
              player={p}
              pos={posOf(p.seat)}
              lastDiscard={view.lastDiscard}
              claimable={claimOpen}
            />
          ))}

          <div className="table-hub">
            {view.pendingKong ? (
              <>
                <span className="hub-label">
                  {view.players[view.pendingKong.seat]?.name} is adding a gang
                </span>
                <TileFace tile={view.pendingKong.tile} size="sm" highlight />
                <span className="hub-note">Rob it, or let it stand</span>
              </>
            ) : claimOpen ? (
              <>
                <span className="hub-label hub-label-hold">Claim window</span>
                <span className="hub-note">
                  {myClaim
                    ? 'Your call — take it or pass'
                    : claimNames.length > 0
                      ? `waiting on ${claimNames.join(', ')}`
                      : 'resolving…'}
                </span>
              </>
            ) : (
              <>
                <span className="hub-label">
                  {view.currentSeat === view.you
                    ? 'Your turn'
                    : `${view.players[view.currentSeat]?.name}\u2019s turn`}
                </span>
                <span className="hub-note">{view.liveWallRemaining} draws left</span>
              </>
            )}
          </div>

          {north && <SeatPlate player={north} view={view} pos="north" />}
          {east && <SeatPlate player={east} view={view} pos="east" />}
          {west && <SeatPlate player={west} view={view} pos="west" />}
          {me && <SeatPlate player={me} view={view} pos="south" self />}

          <FlightLayer flights={flights} onDone={clearFlight} />
        </div>
      </div>

      <div className={cls('my-area', myClaim && 'my-area-claim')}>
        {me && (
          <div className="my-header">
            <span className="seat-wind-badge">{WIND_CHINESE[me.seatWind]}</span>
            <span className="seat-name">{me.name} (you)</span>
            {me.isDealer && <span className="tag dealer">莊</span>}
            {me.passedWater && (
              <span className="tag warn" title="Cannot win until you pass a hand">
                過水
              </span>
            )}
            <span className="seat-score">{me.score}</span>

            {view.analysis && (
              <span className="analysis">
                {view.analysis.shanten <= 0 ? (
                  <>
                    <strong>Waiting</strong>
                    {waitLabels.length > 0 && (
                      <span className="waits">
                        on{' '}
                        {waitLabels.map((w) => (
                          <span key={w.tile} className="wait-chip" title={englishNameOf(w.tile)}>
                            {cornerLabelOf(w.tile)}
                            <span className="wait-count">×{w.remaining}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <strong>{view.analysis.shanten}</strong> away from waiting
                  </>
                )}
              </span>
            )}
          </div>
        )}

        {me && <Melds player={me} size="sm" revealConcealed />}

        <MyHand
          view={view}
          canDiscard={Boolean(decision?.canDiscard)}
          discardable={decision?.discardable ?? []}
          onDiscard={onTileClick}
        />

        {decision && !claimPopup && <ActionBar decision={decision} onAct={onAct} />}
        {!decision && view.phase !== 'handOver' && (
          <div className="action-bar action-bar-idle">
            Waiting on{' '}
            {view.waitingOn.length > 0
              ? view.waitingOn.map((s) => view.players[s]?.name).join(', ')
              : view.players[view.currentSeat]?.name}
            …
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <details className="log-panel">
        <summary>Hand log</summary>
        <ul>
          {[...view.log].reverse().map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>

      {claimPopup && decision && (
        <ClaimPopup decision={decision} view={view} onAct={onAct} />
      )}

      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={resolveConfirm}
        />
      )}

      {view.phase === 'handOver' && view.result && (
        <HandSummary view={view} result={view.result} onNext={() => api.readyForNextHand()} />
      )}

      {view.phase === 'gameOver' && (
        <div className="modal-backdrop">
          <div className="modal modal-narrow">
            <h2>Game over</h2>
            <p className="modal-sub">
              {view.roundNumber > 1 || view.rules.rounds > 1
                ? `${view.rules.rounds} round${view.rules.rounds === 1 ? '' : 's'} played`
                : 'Round complete'}{' '}
              · {view.handNumber} hand{view.handNumber === 1 ? '' : 's'}
            </p>
            <div className="scoreboard">
              {[...view.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={p.seat} className="score-row">
                    <span className="score-name">
                      {i + 1}. {p.name}
                      {p.seat === view.you && ' (you)'}
                    </span>
                    <span className={`score-total ${p.score >= 0 ? 'pos' : 'neg'}`}>
                      {p.score > 0 ? `+${p.score}` : p.score}
                    </span>
                  </div>
                ))}
            </div>

            {isHost ? (
              <>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => void run(api.returnToLobby)}>
                    Back to lobby
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void run(api.startGame)}
                  >
                    New game
                  </button>
                </div>
                <p className="confirm-rule">
                  Everyone keeps their seat either way. The lobby is where you can change the
                  rules or swap a bot out before playing again.
                </p>
              </>
            ) : (
              <p className="confirm-rule">
                Waiting for {view.players[view.hostSeat ?? 0]?.name} to start another game or send
                the table back to the lobby.
              </p>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
