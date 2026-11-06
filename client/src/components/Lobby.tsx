import { useState } from 'react';
import { SEAT_COUNT, WIND_CHINESE, WIND_NAMES, type PlayerView, type RulesConfig } from '@mahjong/shared';
import { api } from '../socket.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { Field, Input, Select } from '../ui/Input.js';
import { Modal } from '../ui/Modal.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { Toast } from '../ui/Toast.js';
import { TileGlyph } from './Tile.js';

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
    <Card className="rules-panel" title="Table rules">
      <p className="field-hint">
        {editable
          ? 'Rules lock when the game starts. They only change the next game.'
          : 'Only the host can change these. Rules lock when the game starts.'}
      </p>

      <p className="rules-group">Money</p>
      <div className="rules-grid">
        <Field label="Base (底)" hint="Paid on every win, before tai">
          <Input
            type="number"
            value={rules.base}
            min={0}
            disabled={!editable}
            onChange={num('base')}
          />
        </Field>

        <Field label="Per tai (台)" hint="Payout = base + tai × this">
          <Input
            type="number"
            value={rules.taiValue}
            min={0}
            disabled={!editable}
            onChange={num('taiValue')}
          />
        </Field>

      </div>
      <p className="rules-group">Length</p>
      <div className="rules-grid">
        <Field label="Rounds (圈)" hint="One round is the deal passing through all four">
          <Input
            type="number"
            value={rules.rounds}
            min={1}
            max={4}
            disabled={!editable}
            onChange={num('rounds')}
          />
        </Field>

        <Field label="Minimum tai" hint="0 allows a bare win (屁胡)">
          <Input
            type="number"
            value={rules.minTai}
            min={0}
            disabled={!editable}
            onChange={num('minTai')}
          />
        </Field>

        <Field label="Tai ceiling" hint="0 for no cap; some tables cap at 8">
          <Input
            type="number"
            value={rules.maxTai}
            min={0}
            disabled={!editable}
            onChange={num('maxTai')}
          />
        </Field>

        <Field label="Dealer streak cap" hint="連莊 stops adding tai past this">
          <Input
            type="number"
            value={rules.streakCap}
            min={0}
            disabled={!editable}
            onChange={num('streakCap')}
          />
        </Field>

        <Field label="Tai scale">
          <Select
            value={rules.taiScale}
            disabled={!editable}
            onChange={(e) => onChange({ taiScale: e.target.value as RulesConfig['taiScale'] })}
          >
            <option value="traditional">Traditional (清一色 8, 碰碰胡 4)</option>
            <option value="simplified">Simplified (清一色 6, 混一色 3)</option>
          </Select>
        </Field>

        <Field label="Dead wall" hint="Tiles left when the hand is declared drawn">
          <Input
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
    </Card>
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
      <div className="landing-top">
        <ThemeToggle />
      </div>
      <header className="landing-head">
        <div className="brand-tiles" aria-hidden="true">
          <TileGlyph tile={0} size="hand" />
          <TileGlyph tile={4} size="hand" />
          <TileGlyph tile={31} size="hand" />
          <TileGlyph tile={27} size="hand" />
        </div>
        <p className="eyebrow">16 tiles · 4 players</p>
        <h1 className="display">
          Taiwanese Mahjong <span className="cn">台灣麻將</span>
        </h1>
        <p>
          Sixteen tiles a hand, five sets and a pair to win. Four players, tai
          scoring, and a dealer streak that decides the money.
        </p>
      </header>

      <ol className="steps">
        <li>
          <span className="step-num">1</span>
          <span>
            <strong>Open a table</strong> and share the 4-letter code.
          </span>
        </li>
        <li>
          <span className="step-num">2</span>
          <span>
            <strong>Fill four seats.</strong> The host can add a bot if someone is missing.
          </span>
        </li>
        <li>
          <span className="step-num">3</span>
          <span>
            <strong>Tap a tile to discard.</strong> Calls show up when you can chi, pong, gang, or win.
          </span>
        </li>
      </ol>

      <Card className="landing-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onCreate(name);
          }}
        >
          <Field label="Your name">
            <Input
              value={name}
              maxLength={20}
              placeholder="Elliot"
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? 'One moment…' : 'Create a table'}
          </Button>
        </form>

        <div className="divider">or join with a code</div>

        <form
          className="join-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && code.length >= 4) onJoin(code, name);
          }}
        >
          <Input
            className="code-input"
            value={code}
            maxLength={4}
            placeholder="ABCD"
            autoComplete="off"
            enterKeyHint="go"
            aria-label="Table code"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" variant="secondary" disabled={busy || code.length < 4}>
            Join
          </Button>
        </form>

        {error && <Toast>{error}</Toast>}

        {onUpdate && (
          <div className="landing-update">
            <Button variant="secondary" fullWidth disabled={busy || updating} onClick={onUpdate}>
              {updating ? 'Updating…' : 'Update'}
            </Button>
            <p className="field-hint">Loads the latest Railway deploy in one tap.</p>
          </div>
        )}
        {import.meta.env.DEV && (
          <p className="dev-link">
            <a href="#/styleguide">Style guide</a>
          </p>
        )}
      </Card>
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
          <p className="eyebrow">Waiting room</p>
          <h1>Table {view.roomCode}</h1>
          <p>Share this code. You will sit at the bottom once play starts.</p>
        </div>
        <div className="lobby-head-actions">
          <ThemeToggle />
          <Button variant="secondary" className="code-badge" onClick={copyCode}>
            {view.roomCode}
            <span className="code-copy">{copied ? 'copied' : 'copy'}</span>
          </Button>
          {onExit && (
            <Button variant="danger" className="exit-game" onClick={onExit}>
              Exit game
            </Button>
          )}
        </div>
      </div>

      <div className="lobby-body">
        <Card className="seats-card" title={`Seats (${view.players.length}/${SEAT_COUNT})`}>
          <ul className="seat-list">
            {view.players.map((p) => (
              <li
                key={p.seat}
                className={p.seat === view.you ? 'me' : ''}
                style={{ borderLeft: `4px solid var(--seat-${['east', 'south', 'west', 'north'][p.seatWind]})` }}
              >
                <span className="seat-wind">
                  {WIND_CHINESE[p.seatWind]} {WIND_NAMES[p.seatWind]}
                </span>
                <span className="seat-name">
                  {p.name}
                  {p.seat === view.you && ' (you)'}
                  {p.seat === view.hostSeat && ' · host'}
                </span>
                <span className="seat-tags">
                  {p.isBot && <Badge>bot</Badge>}
                  {!p.isBot && !p.connected && <Badge tone="warning">away</Badge>}
                </span>
                {isHost && p.isBot && (
                  <Button variant="ghost" size="sm" onClick={() => void run(() => api.removeBot(p.seat))}>
                    Remove
                  </Button>
                )}
                {isHost && !p.isBot && p.seat !== view.you && (
                  <Button variant="danger" size="sm" onClick={() => setKickSeat(p.seat)}>
                    Kick
                  </Button>
                )}
              </li>
            ))}
            {Array.from({ length: seatsLeft }).map((_, i) => (
              <li key={`empty-${i}`} className="empty">
                <span className="seat-wind">—</span>
                <span className="seat-name">Empty seat</span>
              </li>
            ))}
          </ul>

          {isHost && (
            <div className="lobby-actions">
              <Button
                variant="secondary"
                disabled={seatsLeft === 0}
                onClick={() => void run(() => api.addBot())}
              >
                {seatsLeft === 1 ? 'Add a bot (fills the table)' : 'Add a bot'}
              </Button>
              <Button
                variant="primary"
                disabled={view.players.length !== SEAT_COUNT}
                onClick={() => void run(() => api.startGame())}
              >
                {view.players.length === SEAT_COUNT
                  ? 'Start playing'
                  : `Need ${seatsLeft} more`}
              </Button>
            </div>
          )}
          {!isHost && <p className="field-hint">Waiting for the host to start.</p>}
          {error && <Toast>{error}</Toast>}
        </Card>

        <RulesPanel
          rules={view.rules}
          editable={isHost}
          onChange={(patch) => void run(() => api.updateRules(patch))}
        />
      </div>

      {kickSeat !== null && (
        <Modal title={`Kick ${view.players[kickSeat]?.name ?? 'this player'}?`} sheet narrow>
          <p className="confirm-rule">
            They will leave the table. They can come back with the code as a new player,
            in an empty seat.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setKickSeat(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const seat = kickSeat;
                setKickSeat(null);
                void run(() => api.kick(seat));
              }}
            >
              Kick
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
