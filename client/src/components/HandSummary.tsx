import { useState } from 'react';
import { WIND_NAMES, cornerLabelOf, type HandResult, type PlayerView } from '@mahjong/shared';
import { TileFace } from './Tile.js';

function money(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function HandSummary({
  view,
  result,
  onNext,
}: {
  view: PlayerView;
  result: HandResult;
  onNext: () => void | Promise<unknown>;
}) {
  const { rules, players } = view;
  const scored = result.scored;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const you = view.you !== null ? players[view.you] : undefined;
  const youReady = Boolean(you?.readyForNext) || pending;
  const waitingOn = players
    .filter((p) => !p.isBot && p.connected && !p.readyForNext && p.seat !== view.you)
    .map((p) => p.name);

  const totalTai = scored ? scored.handTai : 0;

  const pressNext = async () => {
    if (!you || youReady) return;
    setPending(true);
    setError(null);
    try {
      const res = await onNext();
      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        setPending(false);
        setError('error' in res ? String(res.error) : 'That did not work.');
      }
      // On success keep the button locked; the next view either starts the
      // hand or marks us ready while others catch up.
    } catch {
      setPending(false);
      setError('Could not start the next hand. Try again.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{result.kind === 'win' ? 'Hand won' : 'Drawn hand'}</h2>
        <p className="summary-line">{result.summary}</p>

        {result.kind === 'win' && result.revealedConcealed.length > 0 && (
          <div className="summary-hand">
            {result.revealedConcealed.map((t, i) => (
              <TileFace
                key={`${t}-${i}`}
                tile={t}
                size="sm"
                highlight={t === result.winningTile}
              />
            ))}
          </div>
        )}

        {scored && (
          <table className="tai-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>台</th>
              </tr>
            </thead>
            <tbody>
              {scored.items.map((item) => (
                <tr key={item.key}>
                  <td>
                    <span className="tai-cn">{item.chinese}</span>
                    <span className="tai-en">
                      {item.english}
                      {item.count > 1 ? ` ×${item.count}` : ''}
                    </span>
                  </td>
                  <td className="tai-num">{item.tai}</td>
                </tr>
              ))}
              {scored.items.length === 0 && (
                <tr>
                  <td>
                    <span className="tai-cn">屁胡</span>
                    <span className="tai-en">No scoring pattern</span>
                  </td>
                  <td className="tai-num">0</td>
                </tr>
              )}
              <tr className="tai-subtotal">
                <td>Hand total</td>
                <td className="tai-num">
                  {totalTai}
                  {scored.capped && (
                    <span className="tai-capped"> (capped from {scored.rawHandTai})</span>
                  )}
                </td>
              </tr>
              {scored.dealershipItem && (
                <tr>
                  <td>
                    <span className="tai-cn">{scored.dealershipItem.chinese}</span>
                    <span className="tai-en">
                      {scored.dealershipItem.english} — charged only between the
                      winner and the dealer
                    </span>
                  </td>
                  <td className="tai-num">{scored.dealershipItem.tai}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {result.lines.length > 0 && (
          <div className="payments">
            <h3>Payments</h3>
            <ul>
              {result.lines.map((line, i) => (
                <li key={i}>
                  <strong>{players[line.from]?.name}</strong> pays{' '}
                  <strong>{players[line.to]?.name}</strong> — {line.tai} tai ={' '}
                  {rules.base} + {line.tai} × {rules.taiValue} ={' '}
                  <strong>{line.amount}</strong>
                  {line.includesDealership && (
                    <span className="payment-note"> (includes the dealership)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="scoreboard">
          {players.map((p) => (
            <div key={p.seat} className="score-row">
              <span className="score-name">
                {p.name}
                {p.isDealer ? ' 莊' : ''}
              </span>
              <span className="score-wind">{WIND_NAMES[p.seatWind]}</span>
              <span className={`score-delta ${result.deltas[p.seat]! >= 0 ? 'pos' : 'neg'}`}>
                {money(result.deltas[p.seat] ?? 0)}
              </span>
              <span className="score-total">{p.score}</span>
            </div>
          ))}
        </div>

        <p className="dealer-note">
          {result.dealerContinues
            ? `${players[view.dealerSeat]?.name} keeps the deal — the streak grows to ${view.dealerStreak + 1}, worth ${2 * (view.dealerStreak + 1) + 1} tai.`
            : 'The deal passes to the next player.'}
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void pressNext()}
          disabled={!you || youReady}
        >
          {!you
            ? 'Waiting for the table'
            : youReady
              ? waitingOn.length > 0
                ? `Waiting on ${waitingOn.join(', ')}`
                : 'Starting…'
              : 'Next hand'}
        </button>
        {youReady && waitingOn.length > 0 && (
          <p className="field-hint">The next hand starts when everyone is ready.</p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
