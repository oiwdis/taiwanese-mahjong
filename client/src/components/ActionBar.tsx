import type { AvailableAction, PendingDecision } from '@mahjong/shared';

const REASON_TEXT: Record<PendingDecision['reason'], string> = {
  turn: 'Your turn',
  postCall: 'You called a set — throw a tile',
  claim: 'Claim the discard?',
  robbing: 'Rob the gang?',
};

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

function actionClass(action: AvailableAction): string {
  if (action.type === 'win' || action.type === 'flowerWin') return 'btn btn-win';
  if (action.type === 'pass') return action.armsPassedWater ? 'btn btn-pass-warn' : 'btn btn-pass';
  return 'btn btn-call';
}

/**
 * The choice panel.
 *
 * Every chow, pung, kong and win is a button here. Nothing is taken
 * automatically, and each distinct way of making a call is its own button, so
 * a discarded 5m next to 34567m in hand shows three separate chow options
 * rather than the server picking one.
 */
export function ActionBar({
  decision,
  onAct,
}: {
  decision: PendingDecision;
  onAct: (action: AvailableAction) => void;
}) {
  const actions = [...decision.actions].sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 8) - (TYPE_ORDER[b.type] ?? 8),
  );

  if (actions.length === 0 && !decision.canDiscard) return null;

  return (
    <div className="action-bar">
      <div className="action-reason">
        {REASON_TEXT[decision.reason]}
        {decision.canDiscard && actions.length === 0 && (
          <span className="action-hint"> — tap a tile to discard</span>
        )}
      </div>

      {actions.length > 0 && (
        <div className="action-buttons">
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
      )}

      {decision.decliningWinArmsPassedWater && (
        <div className="action-warning">
          You can win right now. Discarding instead gives up the win and puts you
          過水 — you will not be able to win again until you pass a hand.
        </div>
      )}
    </div>
  );
}
