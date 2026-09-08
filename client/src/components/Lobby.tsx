import { useState } from 'react';
import { SEAT_COUNT, WIND_NAMES, type PlayerView, type RulesConfig } from '@mahjong/shared';
import { api } from '../socket.js';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function RulesPanel({
  rules,
  editable,
  onChange,
}: {
  rules: RulesConfig;
  editable: boolean;
  onChange: (patch: Partial<RulesConfig>) => void;
}) {
  const num = (key: keyof RulesConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [key]: Number(e.target.value) } as Partial<RulesConfig>);
  const bool = (key: keyof RulesConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [key]: e.target.checked } as Partial<RulesConfig>);

  return (
    <div className="rules-panel">
      <h3>Table rules</h3>
      {!editable && <p className="field-hint">Only the host can change these.</p>}

      <div className="rules-grid">
        <Field label="Base (底)" hint="Paid on every win, before tai">
          <input
            type="number"
            value={rules.base}
            min={0}
            disabled={!editable}
            onChange={num('base')}
          />
        </Field>

        <Field label="Per tai (台)" hint="Payout = base + tai × this">
          <input
            type="number"
            value={rules.taiValue}
            min={0}
            disabled={!editable}
            onChange={num('taiValue')}
          />
        </Field>

        <Field label="Rounds (圈)" hint="One round is the deal passing through all four">
          <input
            type="number"
            value={rules.rounds}
            min={1}
            max={4}
            disabled={!editable}
            onChange={num('rounds')}
          />
        </Field>

        <Field label="Minimum tai" hint="0 allows a bare win (屁胡)">
          <input
            type="number"
            value={rules.minTai}
            min={0}
            disabled={!editable}
            onChange={num('minTai')}
          />
        </Field>

        <Field label="Tai ceiling" hint="0 for no cap; some tables cap at 8">
          <input
            type="number"
            value={rules.maxTai}
            min={0}
            disabled={!editable}
            onChange={num('maxTai')}
          />
        </Field>

        <Field label="Dealer streak cap" hint="連莊 stops adding tai past this">
          <input
            type="number"
            value={rules.streakCap}
            min={0}
            disabled={!editable}
            onChange={num('streakCap')}
          />
        </Field>

        <Field label="Tai scale">
          <select
            value={rules.taiScale}
            disabled={!editable}
            onChange={(e) => onChange({ taiScale: e.target.value as RulesConfig['taiScale'] })}
          >
            <option value="traditional">Traditional (清一色 8, 碰碰胡 4)</option>
            <option value="simplified">Simplified (清一色 6, 混一色 3)</option>
          </select>
        </Field>

        <Field label="Dead wall" hint="Tiles left when the hand is declared drawn">
          <input
            type="number"
            value={rules.wallDeadTiles}
            min={0}
            max={32}
            disabled={!editable}
            onChange={num('wallDeadTiles')}
          />
        </Field>
      </div>

      <div className="rules-toggles">
        <label>
          <input
            type="checkbox"
            checked={rules.useFlowers}
            disabled={!editable}
            onChange={bool('useFlowers')}
          />
          Flowers (144 tiles). Off plays the 136-tile set, as much of southern
          Taiwan does.
        </label>

        <label>
          <input
            type="checkbox"
            checked={rules.addedKongClearsPassedWater}
            disabled={!editable}
            onChange={bool('addedKongClearsPassedWater')}
          />
          An added gang (加槓) counts as the action that clears 過水. Disputed
          between groups; this is the mainstream reading.
        </label>

        <label>
          <input
            type="checkbox"
            checked={rules.drawContinuesDealer}
            disabled={!editable}
            onChange={bool('drawContinuesDealer')}
          />
          A drawn hand keeps the dealer (臭莊).
        </label>

        <label>
          <input
            type="checkbox"
            checked={rules.drawAdvancesStreak}
            disabled={!editable}
            onChange={bool('drawAdvancesStreak')}
          />
          A drawn hand also advances the 連莊 count, not just the seat.
        </label>

        <label>
          <input
            type="checkbox"
            checked={rules.pingHuStrict}
            disabled={!editable}
            onChange={bool('pingHuStrict')}
          />
          平胡 is void when the hand scores anything else.
        </label>

        <label>
          <input
            type="checkbox"
            checked={rules.multipleWinnersPerDiscard}
            disabled={!editable}
            onChange={bool('multipleWinnersPerDiscard')}
          />
          Allow 一炮多響 — more than one player winning off a single discard.
        </label>
      </div>
    </div>
  );
}

export function Landing({
  onCreate,
  onJoin,
  error,
  busy,
  onUpdate,
  updating,
}: {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  error: string | null;
  busy: boolean;
  onUpdate?: () => void;
  updating?: boolean;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="landing">
      <header className="landing-head">
        <h1>
          Taiwanese Mahjong <span className="cn">台灣麻將</span>
        </h1>
        <p>
          Sixteen tiles a hand, five sets and a pair to win. Four players, tai
          scoring, and a dealer streak that decides the money.
        </p>
      </header>

      <div className="landing-card">
        <Field label="Your name">
          <input
            value={name}
            maxLength={20}
            placeholder="Elliot"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onCreate(name)}
        >
          Create a table
        </button>

        <div className="divider">or join with a code</div>

        <form
          className="join-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && code.length >= 4) onJoin(code, name);
          }}
        >
          <input
            className="code-input"
            value={code}
            maxLength={4}
            placeholder="ABCD"
            autoComplete="off"
            enterKeyHint="go"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            className="btn"
            disabled={busy || code.length < 4}
          >
            Join
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {onUpdate && (
          <div className="landing-update">
            <button type="button" className="btn" disabled={busy || updating} onClick={onUpdate}>
              {updating ? 'Updating…' : 'Update'}
            </button>
            <p className="field-hint">Loads the latest Railway deploy in one tap.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Lobby({ view, onExit }: { view: PlayerView; onExit?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kickSeat, setKickSeat] = useState<number | null>(null);
  const isHost = view.you !== null && view.you === view.hostSeat;
  const seatsLeft = SEAT_COUNT - view.players.length;

  /** Surface a rejected lobby action instead of letting it fail silently. */
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    const res = await action();
    if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
      const message = 'error' in res ? String(res.error) : 'That did not work.';
      setError(message);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(view.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-head">
        <div>
          <h1>Table {view.roomCode}</h1>
          <p>Share this code so others can join.</p>
        </div>
        <div className="lobby-head-actions">
          <button type="button" className="btn code-badge" onClick={copyCode}>
            {view.roomCode}
            <span className="code-copy">{copied ? 'copied' : 'copy'}</span>
          </button>
          {onExit && (
            <button type="button" className="btn exit-game" onClick={onExit}>
              Exit game
            </button>
          )}
        </div>
      </div>

      <div className="lobby-body">
        <div className="seats-card">
          <h3>
            Seats ({view.players.length}/{SEAT_COUNT})
          </h3>
          <ul className="seat-list">
            {view.players.map((p) => (
              <li key={p.seat} className={p.seat === view.you ? 'me' : ''}>
                <span className="seat-wind">{WIND_NAMES[p.seatWind]}</span>
                <span className="seat-name">
                  {p.name}
                  {p.seat === view.you && ' (you)'}
                  {p.seat === view.hostSeat && ' · host'}
                </span>
                <span className="seat-tags">
                  {p.isBot && <span className="tag">bot</span>}
                  {!p.isBot && !p.connected && <span className="tag warn">away</span>}
                </span>
                {isHost && p.isBot && (
                  <button
                    type="button"
                    className="btn btn-tiny"
                    onClick={() => void run(() => api.removeBot(p.seat))}
                  >
                    remove
                  </button>
                )}
                {isHost && !p.isBot && p.seat !== view.you && (
                  <button
                    type="button"
                    className="btn btn-tiny"
                    onClick={() => setKickSeat(p.seat)}
                  >
                    Kick
                  </button>
                )}
              </li>
            ))}
            {Array.from({ length: seatsLeft }).map((_, i) => (
              <li key={`empty-${i}`} className="empty">
                <span className="seat-wind">—</span>
                <span className="seat-name">Empty</span>
              </li>
            ))}
          </ul>

          {isHost && (
            <div className="lobby-actions">
              <button
                type="button"
                className="btn"
                disabled={seatsLeft === 0}
                onClick={() => void run(() => api.addBot())}
              >
                {seatsLeft === 1 ? 'Add a bot (fills the table)' : 'Add a bot'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={view.players.length !== SEAT_COUNT}
                onClick={() => void run(() => api.startGame())}
              >
                {view.players.length === SEAT_COUNT
                  ? 'Start playing'
                  : `Need ${seatsLeft} more`}
              </button>
            </div>
          )}
          {!isHost && <p className="field-hint">Waiting for the host to start.</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <RulesPanel
          rules={view.rules}
          editable={isHost}
          onChange={(patch) => void run(() => api.updateRules(patch))}
        />
      </div>

      {kickSeat !== null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="kick-title">
          <div className="modal modal-narrow">
            <h2 id="kick-title">Kick {view.players[kickSeat]?.name ?? 'this player'}?</h2>
            <p className="confirm-rule">
              They will leave the table. They cannot rejoin with the same seat
              unless they come back as a new player.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setKickSeat(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-win"
                onClick={() => {
                  const seat = kickSeat;
                  setKickSeat(null);
                  void run(() => api.kick(seat));
                }}
              >
                Kick
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
