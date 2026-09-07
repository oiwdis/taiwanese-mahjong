import { useEffect, useState } from 'react';
import type { PlayerView } from '@mahjong/shared';
import { api, clearSession, loadSession, onView, saveSession, socket } from './socket.js';
import { Landing, Lobby } from './components/Lobby.js';
import { Table } from './components/Table.js';

export function App() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => onView(setView), []);

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
      if ('ok' in res && res.ok === false) clearSession();
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

  const leave = () => {
    clearSession();
    setView(null);
    void api.updateRules({});
    window.location.reload();
  };

  if (!connected) {
    return (
      <div className="landing">
        <div className="landing-card">
          <p>Connecting to the table…</p>
        </div>
      </div>
    );
  }

  if (!view) {
    return <Landing onCreate={create} onJoin={join} error={error} busy={busy} />;
  }

  if (view.phase === 'lobby') {
    return (
      <>
        <Lobby view={view} />
        <button type="button" className="btn btn-tiny leave" onClick={leave}>
          Leave table
        </button>
      </>
    );
  }

  return (
    <>
      <Table view={view} />
      <button type="button" className="btn btn-tiny leave" onClick={leave}>
        Leave
      </button>
    </>
  );
}
