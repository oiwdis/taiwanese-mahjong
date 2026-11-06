import { useEffect, useState } from 'react';
import type { PlayerView } from '@mahjong/shared';
import { api, clearSession, loadSession, onView, saveSession, socket } from './socket.js';
import { Landing, Lobby } from './components/Lobby.js';
import { TileBack } from './components/Tile.js';
import { Table } from './components/Table.js';
import { StyleGuide } from './styleguide/StyleGuide.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';
import { Modal } from './ui/Modal.js';
import { useServerUpdate } from './useServerUpdate.js';

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
    <Button
      variant={primary ? 'primary' : 'secondary'}
      disabled={applying}
      onClick={onUpdate}
    >
      {applying ? 'Updating…' : 'Update'}
    </Button>
  );
}

function Connecting({
  applying,
  onUpdate,
  rejoining,
  code,
}: {
  applying: boolean;
  onUpdate: () => void;
  rejoining?: boolean;
  code?: string;
}) {
  return (
    <div className="landing">
      <Card className="status-card">
        <div className="brand-tiles" aria-hidden="true">
          <TileBack size="hand" />
          <TileBack size="hand" />
          <TileBack size="hand" />
        </div>
        <h1>{rejoining ? `Opening ${code ?? 'your table'}…` : 'Connecting to the table…'}</h1>
        <p className="field-hint">
          {rejoining
            ? 'Your seat is saved on this device. Hang on while we sit you back down.'
            : 'If Railway just finished deploying, tap Update once instead of hard-refreshing.'}
        </p>
        <UpdateButton applying={applying} onUpdate={onUpdate} primary />
      </Card>
    </div>
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
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  );
  const [rejoinFailed, setRejoinFailed] = useState(false);
  const update = useServerUpdate();

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Reclaim a seat after a refresh or a dropped connection.
  useEffect(() => {
    if (!connected) return;
    const stored = loadSession();
    if (!stored || view) return;
    void (async () => {
      const res = await api.joinRoom(stored.roomCode, stored.name, stored.token);
      if ('ok' in res && res.ok === false) {
        clearSession();
        setRejoinFailed(true);
        setError(res.error || 'That table is no longer open.');
      }
    })();
  }, [connected, view]);

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

  if (import.meta.env.DEV && hash.startsWith('#/styleguide')) {
    return <StyleGuide />;
  }

  const stored = loadSession();

  const leaveDialog = confirmLeave && (
    <Modal title="Exit this table?" sheet narrow>
      <p className="confirm-rule">
        You will leave the room. Use the table code to come back if it is still open.
      </p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
          Stay
        </Button>
        <Button variant="danger" onClick={() => void leave()}>
          Exit game
        </Button>
      </div>
    </Modal>
  );

  const reconnecting = view && !connected && (
    <div className="reconnect-overlay" role="status">
      <Card className="status-card">
        <h2>Reconnecting…</h2>
        <p className="field-hint">
          Your seat is saved on this device. The table will catch up when the connection returns.
        </p>
        <UpdateButton applying={update.applying} onUpdate={update.apply} primary />
      </Card>
    </div>
  );

  const banner = (
    <UpdateBanner show={update.available} applying={update.applying} onUpdate={update.apply} />
  );

  if (!view) {
    if (!connected || (stored && !rejoinFailed)) {
      return (
        <Connecting
          applying={update.applying}
          onUpdate={update.apply}
          rejoining={Boolean(stored && connected && !rejoinFailed)}
          code={stored?.roomCode}
        />
      );
    }
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
        <Lobby view={view} onExit={() => setConfirmLeave(true)} />
        {leaveDialog}
        {reconnecting}
      </>
    );
  }

  return (
    <>
      {banner}
      <Table view={view} onExit={() => setConfirmLeave(true)} />
      {leaveDialog}
      {reconnecting}
    </>
  );
}
