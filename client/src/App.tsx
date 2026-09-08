import { useEffect, useState } from 'react';
import type { PlayerView } from '@mahjong/shared';
import {
  api,
  bindSocketLifecycle,
  clearSession,
  loadSession,
  onView,
  saveSession,
  socket,
} from './socket.js';
import { Landing, Lobby } from './components/Lobby.js';
import { Table } from './components/Table.js';
import { shouldReclaimSeat, shouldShowReconnectBanner } from './reclaim.js';
import { useServerUpdate } from './useServerUpdate.js';

export { shouldReclaimSeat, shouldShowReconnectBanner } from './reclaim.js';

function UpdateButton({
  applying,
  onUpdate,
  primary = false,
}: {
  applying: boolean;
  onUpdate: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn'}
      disabled={applying}
      onClick={onUpdate}
    >
      {applying ? 'Updating…' : 'Update'}
    </button>
  );
}

function UpdateBanner({
  show,
  applying,
  onUpdate,
}: {
  show: boolean;
  applying: boolean;
  onUpdate: () => void;
}) {
  if (!show) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is live.</span>
      <UpdateButton applying={applying} onUpdate={onUpdate} />
    </div>
  );
}

export function App() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [rejoining, setRejoining] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const update = useServerUpdate();

  useEffect(() => onView(setView), []);

  useEffect(() => {
    const onKicked = (payload: { reason: string }) => {
      clearSession();
      setView(null);
      setConfirmLeave(false);
      setError(payload.reason || 'The host removed you from the table.');
    };
    socket.on('kicked', onKicked);
    return () => {
      socket.off('kicked', onKicked);
    };
  }, []);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    // The socket can finish connecting between the initial render and this
    // effect running, which would leave us waiting for an event that already
    // fired, so re-read the live state here.
    setConnected(socket.connected);
    const unbind = bindSocketLifecycle();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      unbind();
    };
  }, []);

  // Reclaim a seat after a refresh or a dropped connection. Do not wait for
  // `view` to be empty — a transient disconnect keeps the last table on
  // screen, and skipping joinRoom here is what forced a hard refresh.
  useEffect(() => {
    if (!connected) return;
    const stored = loadSession();
    if (!shouldReclaimSeat(connected, stored) || !stored) return;

    let cancelled = false;
    setRejoining(true);
    void (async () => {
      const res = await api.joinRoom(stored.roomCode, stored.name, stored.token);
      if (cancelled) return;
      if ('ok' in res && res.ok === false) {
        clearSession();
        setView(null);
        setError(res.error);
      }
      setRejoining(false);
    })();
    return () => {
      cancelled = true;
      setRejoining(false);
    };
  }, [connected]);

  const create = async (name: string) => {
    setBusy(true);
    setError(null);
    const res = await api.createRoom(name);
    setBusy(false);
    if ('ok' in res && res.ok === false) {
      setError(res.error);
      return;
    }
    saveSession({ roomCode: res.roomCode, token: res.token, name: name || 'Player' });
  };

  const join = async (code: string, name: string) => {
    setBusy(true);
    setError(null);
    const res = await api.joinRoom(code, name);
    setBusy(false);
    if ('ok' in res && res.ok === false) {
      setError(res.error);
      return;
    }
    saveSession({ roomCode: res.roomCode, token: res.token, name: name || 'Player' });
  };

  const leave = async () => {
    setConfirmLeave(false);
    try {
      await api.leaveRoom();
    } finally {
      clearSession();
      setView(null);
    }
  };

  const connectingCard = (
    <div className="landing">
      <div className="landing-card">
        <p>{rejoining ? 'Rejoining the table…' : 'Connecting to the table…'}</p>
        <p className="field-hint">
          If Railway just finished deploying, tap Update once instead of hard-refreshing.
        </p>
        <UpdateButton applying={update.applying} onUpdate={update.apply} primary />
      </div>
    </div>
  );

  // Keep a live table mounted across a blip so the hand and the seat stay put.
  // Only the first paint (no view yet) uses the full-page connecting card.
  if (!view && (!connected || rejoining || loadSession())) {
    return connectingCard;
  }

  if (!connected && !view) {
    return connectingCard;
  }

  const leaveDialog = confirmLeave && (
    <div className="modal-backdrop" role="dialog" aria-labelledby="exit-title" aria-modal="true">
      <div className="modal modal-narrow">
        <h2 id="exit-title">Exit this table?</h2>
        <p className="confirm-rule">
          You will leave the room. Use the table code to come back if it is still open.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setConfirmLeave(false)}>
            Stay
          </button>
          <button type="button" className="btn btn-win" onClick={() => void leave()}>
            Exit game
          </button>
        </div>
      </div>
    </div>
  );

  const banner = (
    <UpdateBanner show={update.available} applying={update.applying} onUpdate={update.apply} />
  );

  const reconnectBanner = shouldShowReconnectBanner(connected, rejoining, Boolean(view)) && (
    <div className="reconnect-banner" role="status">
      <span className="spin" aria-hidden="true" />
      <span>{connected ? 'Rejoining the table…' : 'Connection lost — reconnecting…'}</span>
    </div>
  );

  if (!view) {
    return (
      <>
        {banner}
        <Landing
          onCreate={create}
          onJoin={join}
          error={error}
          busy={busy}
          onUpdate={update.apply}
          updating={update.applying}
        />
      </>
    );
  }

  if (view.phase === 'lobby') {
    return (
      <>
        {banner}
        {reconnectBanner}
        <Lobby view={view} onExit={() => setConfirmLeave(true)} />
        {leaveDialog}
      </>
    );
  }

  return (
    <>
      {banner}
      {reconnectBanner}
      <Table view={view} onExit={() => setConfirmLeave(true)} />
      {leaveDialog}
    </>
  );
}
