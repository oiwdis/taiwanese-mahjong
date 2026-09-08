import type { AvailableAction, PendingDecision, PlayerView } from '@mahjong/shared';
import { englishNameOf } from '@mahjong/shared';
import { TileFace } from './Tile.js';

const TYPE_ORDER: Record<string, number> = {
  win: 0,
  flowerWin: 1,
  kong: 2,
  concealedKong: 3,
  addedKong: 4,
  pung: 5,
  chow: 6,
  pass: 9,
};

const CALL_NAME: Record<string, string> = {
  win: 'hu',
  flowerWin: 'hu',
  kong: 'gang',
  pung: 'pong',
  chow: 'chi',
};

function actionClass(action: AvailableAction): string {
  if (action.type === 'win' || action.type === 'flowerWin') return 'btn btn-win';
  if (action.type === 'pass') return action.armsPassedWater ? 'btn btn-pass-warn' : 'btn btn-pass';
  return 'btn btn-call';
}

function headline(reason: PendingDecision['reason'], actions: AvailableAction[]): string {
  if (reason === 'robbing') return 'You can rob this gang';
  const names = [...new Set(actions.filter((a) => a.type !== 'pass').map((a) => CALL_NAME[a.type]).filter(Boolean))];
  if (names.length === 0) return 'Claim this tile?';
  if (names.length === 1) return `You can ${names[0]}`;
  if (names.length === 2) return `You can ${names[0]} or ${names[1]}`;
  return `You can ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

/**
 * Full-screen prompt when a discard (or added gang) can be taken.
 *
 * The bottom action bar is easy to miss on a phone. This sits on top of the
 * table with the tile, who threw it, and every legal call including Pass.
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
  const actions = [...decision.actions].sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 8) - (TYPE_ORDER[b.type] ?? 8),
  );
  const tile = view.lastDiscard?.tile ?? view.pendingKong?.tile ?? null;
  const fromSeat = view.lastDiscard?.seat ?? view.pendingKong?.seat ?? null;
  const fromName = fromSeat !== null ? view.players[fromSeat]?.name : null;
  const source = view.pendingKong ? 'is adding a gang' : 'discarded';

  return (
    <div className="modal-backdrop claim-popup" role="dialog" aria-modal="true" aria-labelledby="claim-title">
      <div className="modal modal-narrow claim-popup-card">
        <h2 id="claim-title">{headline(decision.reason, actions)}</h2>
        {tile !== null && (
          <div className="claim-popup-tile">
            <TileFace tile={tile} size="lg" highlight />
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
        <div className="action-buttons claim-popup-buttons">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={actionClass(action)}
              onClick={() => onAct(action)}
            >
              <span className="action-label">{action.label}</span>
              {action.taiPreview !== undefined && action.type !== 'pass' && (
                <span className="action-tai">{action.taiPreview} tai</span>
              )}
            </button>
          ))}
        </div>
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
