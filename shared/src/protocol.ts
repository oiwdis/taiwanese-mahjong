import type { RulesConfig } from './config.js';
import type { PlayerView } from './state.js';
import type { Tile } from './tiles.js';

/** Room codes are short, unambiguous, and case-insensitive on the way in. */
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ACDEFGHJKLMNPQRSTUVWXY345789';

export interface JoinRequest {
  roomCode: string;
  name: string;
  /** Returned by the server on first join; replayed to reclaim a seat. */
  token?: string;
}

export interface JoinResponse {
  ok: true;
  roomCode: string;
  token: string;
  seat: number | null;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type Result<T> = T | ErrorResponse;

/** Client to server. */
export interface ClientEvents {
  createRoom: (
    payload: { name: string; rules?: Partial<RulesConfig> },
    ack: (res: Result<JoinResponse>) => void,
  ) => void;

  joinRoom: (payload: JoinRequest, ack: (res: Result<JoinResponse>) => void) => void;

  leaveRoom: (ack: (res: Result<{ ok: true }>) => void) => void;

  updateRules: (
    payload: { rules: Partial<RulesConfig> },
    ack: (res: Result<{ ok: true }>) => void,
  ) => void;

  /** Host fills the remaining seats with bots. */
  addBot: (ack: (res: Result<{ ok: true }>) => void) => void;
  removeBot: (payload: { seat: number }, ack: (res: Result<{ ok: true }>) => void) => void;

  /** Host starts a game, from the lobby or straight off a finished one. */
  startGame: (ack: (res: Result<{ ok: true }>) => void) => void;

  /**
   * Host sends a finished table back to the lobby, keeping everyone in their
   * seats so the rules can be changed before playing again.
   */
  returnToLobby: (ack: (res: Result<{ ok: true }>) => void) => void;

  /**
   * Execute exactly one offered choice, identified by the id the server sent.
   * The server never infers which chow or which kong was meant.
   */
  act: (payload: { actionId: string }, ack: (res: Result<{ ok: true }>) => void) => void;

  /** Throw a tile. Separate from `act` because clicking a tile is the gesture. */
  discard: (payload: { tile: Tile }, ack: (res: Result<{ ok: true }>) => void) => void;

  /** Acknowledge the hand summary and move on. */
  readyForNextHand: (ack: (res: Result<{ ok: true }>) => void) => void;
}

/** Server to client. */
export interface ServerEvents {
  /** Full personalised state. Sent on every change; the client just renders it. */
  view: (view: PlayerView) => void;
  /** Transient toast, e.g. "West called pung". */
  notice: (payload: { message: string; kind: 'info' | 'warn' | 'error' }) => void;
  roomClosed: (payload: { reason: string }) => void;
}
