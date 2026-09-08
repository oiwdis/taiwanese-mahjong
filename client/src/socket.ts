import { io, type Socket } from 'socket.io-client';
import type { PlayerView, RulesConfig } from '@mahjong/shared';

export const socket: Socket = io({ autoConnect: true });

type Ack<T> = T | { ok: false; error: string };

function call<T>(event: string, payload?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const args: unknown[] = payload === undefined ? [] : [payload];
    socket.emit(event, ...args, (res: Ack<T>) => resolve(res));
  });
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
