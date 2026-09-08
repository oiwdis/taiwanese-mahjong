import { io, type Socket } from 'socket.io-client';
import type { PlayerView, RulesConfig } from '@mahjong/shared';

const STORAGE_KEY = 'mahjong.session';

export interface StoredSession {
  roomCode: string;
  token: string;
  name: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing, nothing to do.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/** How long we wait for a server acknowledgement before telling the player. */
export const ACK_TIMEOUT_MS = 10_000;

export const socket: Socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 400,
  reconnectionDelayMax: 5000,
  // The handshake carries the stored seat so the server can remap this socket
  // the moment it comes back — before React has a chance to call joinRoom.
  auth: (cb) => {
    cb(loadSession() ?? {});
  },
});

type Ack<T> = T | { ok: false; error: string };

function call<T>(event: string, payload?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: Ack<T>) => {
      if (settled) return;
      settled = true;
      resolve(res);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: 'The table did not answer. Try again.' });
    }, ACK_TIMEOUT_MS);
    const args: unknown[] = payload === undefined ? [] : [payload];
    socket.emit(event, ...args, (res: Ack<T>) => {
      clearTimeout(timer);
      finish(res);
    });
  });
}

/** Bring the socket back when a phone tab wakes or the network returns. */
export function bindSocketLifecycle(): () => void {
  const wake = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!socket.connected) socket.connect();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('focus', wake);
  return () => {
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', wake);
  };
}

export interface JoinResult {
  ok: true;
  roomCode: string;
  token: string;
  seat: number | null;
}

export const api = {
  createRoom: (name: string, rules?: Partial<RulesConfig>) =>
    call<JoinResult>('createRoom', { name, rules }),
  joinRoom: (roomCode: string, name: string, token?: string) =>
    call<JoinResult>('joinRoom', { roomCode, name, token }),
  updateRules: (rules: Partial<RulesConfig>) => call<{ ok: true }>('updateRules', { rules }),
  addBot: () => call<{ ok: true }>('addBot'),
  removeBot: (seat: number) => call<{ ok: true }>('removeBot', { seat }),
  kick: (seat: number) => call<{ ok: true }>('kick', { seat }),
  replaceWithBot: (seat: number) => call<{ ok: true }>('replaceWithBot', { seat }),
  startGame: () => call<{ ok: true }>('startGame'),
  returnToLobby: () => call<{ ok: true }>('returnToLobby'),
  leaveRoom: () => call<{ ok: true }>('leaveRoom'),
  act: (actionId: string) => call<{ ok: true }>('act', { actionId }),
  discard: (tile: number) => call<{ ok: true }>('discard', { tile }),
  readyForNextHand: () => call<{ ok: true }>('readyForNextHand'),
};

export function onView(handler: (view: PlayerView) => void): () => void {
  socket.on('view', handler);
  return () => socket.off('view', handler);
}
