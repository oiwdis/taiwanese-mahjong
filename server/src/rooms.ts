import { randomUUID } from 'node:crypto';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SEAT_COUNT,
  sanitizeRules,
  type PlayerView,
  type RulesConfig,
} from '@mahjong/shared';
import { Game } from './game.js';
import { botDelay, chooseBotMove } from './bot.js';

const BOT_NAMES = ['Ah-Ming', 'Hsiao-Yu', 'Chen', 'Lin', 'Wang', 'Huang'];

export interface Connection {
  socketId: string;
  token: string;
}

export class Room {
  readonly code: string;
  readonly game: Game;
  hostToken: string | null = null;
  createdAt = Date.now();

  /** token -> socket id, for the connected humans. */
  private connections = new Map<string, string>();
  private kickedTokens = new Set<string>();
  private botTimers = new Map<number, NodeJS.Timeout>();
  private emit: (socketId: string, view: PlayerView) => void;

  constructor(code: string, emit: (socketId: string, view: PlayerView) => void) {
    this.code = code;
    this.game = new Game();
    this.emit = emit;
  }

  get isFull(): boolean {
    return this.game.players.length >= SEAT_COUNT;
  }

  get humanCount(): number {
    return this.game.players.filter((p) => !p.isBot).length;
  }

  get connectedHumanCount(): number {
    return this.game.players.filter((p) => !p.isBot && p.connected).length;
  }

  hostSeat(): number | null {
    if (!this.hostToken) return null;
    return this.game.playerByToken(this.hostToken)?.seat ?? null;
  }

  isHost(token: string): boolean {
    return this.hostToken === token;
  }

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  wasKicked(token: string): boolean {
    return this.kickedTokens.has(token);
  }

  /**
   * Host removes a seated player from the lobby.
   *
   * Humans and bots both go through this path. Mid-game kicks are refused
   * because a 16-tile hand cannot lose a seat without breaking the deal.
   */
  kick(seat: number):
    | { ok: true; socketId: string | null; name: string; token: string }
    | { ok: false; error: string } {
    if (this.game.phase !== 'lobby') {
      return { ok: false, error: 'You can only kick people from the lobby' };
    }
    const player = this.game.players[seat];
    if (!player) return { ok: false, error: 'Nobody in that seat' };
    if (player.token === this.hostToken) {
      return { ok: false, error: 'You cannot kick yourself' };
    }
    const socketId = this.connections.get(player.token) ?? null;
    this.connections.delete(player.token);
    this.kickedTokens.add(player.token);
    this.game.removePlayer(seat);
    return { ok: true, socketId, name: player.name, token: player.token };
  }

  /**
   * Host swaps a disconnected human for a bot without emptying the seat.
   *
   * Lobby kicks still use `kick`. Mid-game a missing player has a hand, so
   * the only safe move is to keep the seat and let a bot finish it.
   */
  replaceAwayWithBot(seat: number):
    | { ok: true; socketId: string | null; name: string; token: string }
    | { ok: false; error: string } {
    if (this.game.phase === 'lobby') {
      return { ok: false, error: 'In the lobby, kick them instead' };
    }
    const player = this.game.players[seat];
    if (!player) return { ok: false, error: 'Nobody in that seat' };
    if (player.token === this.hostToken) {
      return { ok: false, error: 'You cannot replace yourself' };
    }
    const oldToken = player.token;
    const socketId = this.connections.get(oldToken) ?? null;
    const res = this.game.replaceHumanWithBot(seat);
    if (!res.ok) return res;
    this.connections.delete(oldToken);
    this.kickedTokens.add(oldToken);
    player.token = randomUUID();
    const timer = this.botTimers.get(seat);
    if (timer) {
      clearTimeout(timer);
      this.botTimers.delete(seat);
    }
    return { ok: true, socketId, name: player.name, token: oldToken };
  }

  join(name: string, socketId: string, token?: string): { token: string; seat: number | null } {
    // Reclaim an existing seat when the token is recognised.
    if (token) {
      const existing = this.game.playerByToken(token);
      if (existing) {
        existing.connected = true;
        existing.name = name || existing.name;
        this.connections.set(token, socketId);
        return { token, seat: existing.seat };
      }
    }

    const newToken = randomUUID();
    if (this.isFull) {
      // Spectator: no seat, but still receives views.
      this.connections.set(newToken, socketId);
      return { token: newToken, seat: null };
    }

    const player = this.game.addPlayer(name || 'Player', newToken, false);
    this.connections.set(newToken, socketId);
    if (!this.hostToken) this.hostToken = newToken;
    return { token: newToken, seat: player?.seat ?? null };
  }

  disconnect(socketId: string): void {
    for (const [token, id] of this.connections) {
      if (id !== socketId) continue;
      this.connections.delete(token);
      const player = this.game.playerByToken(token);
      if (player) this.game.markDisconnected(player.seat);
    }
  }

  addBot(): boolean {
    if (this.isFull) return false;
    const used = new Set(this.game.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${this.game.players.length}`;
    this.game.addPlayer(name, randomUUID(), true);
    return true;
  }

  removeBot(seat: number): boolean {
    const player = this.game.players[seat];
    if (!player || !player.isBot) return false;
    return this.kick(seat).ok;
  }

  fillWithBots(): void {
    while (!this.isFull) this.addBot();
  }

  updateRules(rules: Partial<RulesConfig>): void {
    if (this.game.phase !== 'lobby') return;
    this.game.rules = sanitizeRules({ ...this.game.rules, ...rules });
  }

  // -------------------------------------------------------------------------
  // Views and the bot pump
  // -------------------------------------------------------------------------

  viewFor(token: string): PlayerView {
    const player = this.game.playerByToken(token);
    const view = this.game.buildView(player?.seat ?? null);
    view.roomCode = this.code;
    view.hostSeat = this.hostSeat();
    return view;
  }

  broadcast(): void {
    for (const [token, socketId] of this.connections) {
      this.emit(socketId, this.viewFor(token));
    }
  }

  /**
   * Give bots their turns.
   *
   * Bots go through the same `act` and `discard` entry points as humans, so
   * the rules cannot diverge between them. Each pending bot decision gets a
   * timer stamped with the current epoch; if the state moves on before the
   * timer fires (another seat claimed the discard, say) the stale move is
   * dropped and the pump runs again.
   */
  pumpBots(): void {
    const game = this.game;
    if (game.phase === 'lobby' || game.phase === 'gameOver') return;

    for (const seat of game.waitingSeats()) {
      const player = game.players[seat];
      if (!player?.isBot) continue;
      if (this.botTimers.has(seat)) continue;

      const epoch = game.epoch;
      const reason = game.decisionFor(seat)?.reason ?? 'turn';

      const timer = setTimeout(() => {
        this.botTimers.delete(seat);
        if (game.epoch !== epoch) {
          this.pumpBots();
          return;
        }
        const move = chooseBotMove(game, seat);
        if (move) {
          if (move.kind === 'act') game.act(seat, move.actionId);
          else game.discard(seat, move.tile);
        }
        this.broadcast();
        this.pumpBots();
      }, botDelay(reason));

      this.botTimers.set(seat, timer);
    }
  }

  dispose(): void {
    for (const timer of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private emit: (socketId: string, view: PlayerView) => void;

  constructor(emit: (socketId: string, view: PlayerView) => void) {
    this.emit = emit;
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 200; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a room code');
  }

  create(): Room {
    const room = new Room(this.generateCode(), this.emit);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /**
   * Remap a freshly connected socket onto a seat it already owns.
   *
   * Socket.IO hands out a new id after every drop. Without this, the player
   * looks connected on their screen but the server no longer routes views or
   * actions to them until they refresh.
   */
  restoreHandshake(
    socketId: string,
    auth: { roomCode?: string; token?: string; name?: string },
  ): { room: Room; token: string } | null {
    const roomCode = auth.roomCode?.trim() ?? '';
    const token = auth.token?.trim() ?? '';
    if (!roomCode || !token) return null;
    const room = this.get(roomCode);
    if (!room || room.wasKicked(token)) return null;
    const known = room.game.playerByToken(token);
    if (!known) return null;
    room.join(auth.name || known.name, socketId, token);
    return { room, token };
  }

  close(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.dispose();
    this.rooms.delete(code);
  }

  /** Drop rooms that nobody has been connected to for a while. */
  sweep(maxIdleMs = 1000 * 60 * 60 * 3): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.connectedHumanCount > 0) {
        room.createdAt = now;
        continue;
      }
      if (now - room.createdAt > maxIdleMs) this.close(code);
    }
  }

  get size(): number {
    return this.rooms.size;
  }
}
