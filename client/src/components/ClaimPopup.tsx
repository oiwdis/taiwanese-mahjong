import { useEffect, useRef, useState } from 'react';
import type { AvailableAction, PendingDecision, PlayerView } from '@mahjong/shared';
import { englishNameOf } from '@mahjong/shared';
import { ActionButtons } from '../ui/ActionButtons.js';
import { TileFace } from './Tile.js';

const CALL_NAME: Record<string, string> = {
  win: 'hu',
  flowerWin: 'hu',
  kong: 'gang',
  pung: 'pong',
  chow: 'chi',
};

function headline(reason: PendingDecision['reason'], actions: AvailableAction[]): string {
  if (reason === 'robbing') return 'You can rob this gang';
  const names = [
    ...new Set(actions.filter((a) => a.type !== 'pass').map((a) => CALL_NAME[a.type]).filter(Boolean)),
  ];
  if (names.length === 0) return 'Claim this tile?';
  if (names.length === 1) return `You can ${names[0]}`;
  if (names.length === 2) return `You can ${names[0]} or ${names[1]}`;
  return `You can ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

function HoldClock({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  const span = useRef(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline == null) {
    return <p className="hold-note">Take your time. The table holds until you choose.</p>;
  }

  if (span.current === 0) span.current = Math.max(1000, deadline - now);
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  return (
    <div>
      <p className="hold-note" role="timer">
        {secs}s left to choose
      </p>
      <div className="hold-timer" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (left / span.current) * 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Prompt when a discard (or added gang) can be taken.
 *
 * Sits over the table so the hand stays readable underneath. The tile, who
 * threw it, and every legal call including Pass are in one place.
 */
export function ClaimPopup({
  decision,
  view,
  onAct,
}: {
  decision: PendingDecision;
  view: PlayerView;
  onAct: (action: AvailableAction) => void;
}) {
  const tile = view.lastDiscard?.tile ?? view.pendingKong?.tile ?? null;
  const fromSeat = view.lastDiscard?.seat ?? view.pendingKong?.seat ?? null;
  const fromName = fromSeat !== null ? view.players[fromSeat]?.name : null;
  const source = view.pendingKong ? 'is adding a gang' : 'discarded';

  return (
    <div className="claim-popup" role="dialog" aria-modal="true" aria-labelledby="claim-title">
      <div className="modal modal-narrow claim-popup-card">
        <h2 id="claim-title">{headline(decision.reason, decision.actions)}</h2>
        {tile !== null && (
          <div className="claim-popup-tile">
            <TileFace tile={tile} size="hand" highlight claimable />
            <p>
              {fromName ? (
                <>
                  <strong>{fromName}</strong> {source} {englishNameOf(tile)}
                </>
              ) : (
                englishNameOf(tile)
              )}
            </p>
          </div>
        )}
        <p className="modal-sub">The table is holding for you. Take it or pass.</p>
        <ActionButtons
          actions={decision.actions}
          onAct={onAct}
          className="claim-popup-buttons"
          showTiles
        />
        <HoldClock deadline={decision.deadline} />
        {decision.decliningWinArmsPassedWater && (
          <div className="action-warning">
            You can win right now. Passing or discarding instead gives up the win
            and puts you 過水.
          </div>
        )}
      </div>
    </div>
  );
}
