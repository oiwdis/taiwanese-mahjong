import type { AvailableAction, PendingDecision } from '@mahjong/shared';
import { ActionButtons } from '../ui/ActionButtons.js';

const REASON_TEXT: Record<PendingDecision['reason'], string> = {
  turn: 'Your turn',
  postCall: 'You called a set — throw a tile',
  claim: 'Claim the discard?',
  robbing: 'Rob the gang?',
};

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
  if (decision.actions.length === 0 && !decision.canDiscard) return null;

  return (
    <div className="action-bar">
      <div className="action-reason">
        {REASON_TEXT[decision.reason]}
        {decision.canDiscard && decision.actions.length === 0 && (
          <span className="action-hint"> — tap a tile to discard</span>
        )}
      </div>

      {decision.actions.length > 0 && <ActionButtons actions={decision.actions} onAct={onAct} />}

      {decision.decliningWinArmsPassedWater && (
        <div className="action-warning">
          You can win right now. Discarding instead gives up the win and puts you
          過水 — you will not be able to win again until you pass a hand.
        </div>
      )}
    </div>
  );
}
