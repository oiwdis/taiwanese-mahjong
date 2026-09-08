import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { SEAT_COUNT, sanitizeRules, type PlayerView } from '@mahjong/shared';
import { RoomManager, type Room } from './rooms.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = [
  path.resolve(here, '../../client/dist'),
  path.resolve(here, './dist'),
  path.resolve(here, '../dist'),
].find((dir) => existsSync(path.join(dir, 'index.html'))) ?? path.resolve(here, './dist');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
});

const rooms = new RoomManager((socketId, view: PlayerView) => {
  io.to(socketId).emit('view', view);
});

/** socket id -> which room and identity it is using. */
interface Session {
  roomCode: string;
  token: string;
}
const sessions = new Map<string, Session>();

function sessionRoom(socketId: string): { room: Room; session: Session } | null {
  const session = sessions.get(socketId);
  if (!session) return null;
  const room = rooms.get(session.roomCode);
  if (!room) return null;
  return { room, session };
}

function fail(message: string) {
  return { ok: false as const, error: message };
}

type Ack = (res: unknown) => void;

/**
 * Wrap a socket handler so it always answers.
 *
 * Socket.IO does not catch exceptions thrown inside a handler, so without this
 * a bug in the engine leaves the client waiting on an acknowledgement that
 * never arrives, which looks like a hang rather than an error.
 */
function handler<F extends (...args: never[]) => unknown>(name: string, fn: F): F {
  return ((...args: Parameters<F>) => {
    try {
      fn(...(args as never[]));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${name}] ${message}\n`, err instanceof Error ? err.stack : '');
      const ack = args[args.length - 1];
      if (typeof ack === 'function') (ack as Ack)(fail(`Server error: ${message}`));
    }
  }) as unknown as F;
}

io.on('connection', (socket) => {
  socket.on('createRoom', handler('createRoom', (payload, ack) => {
    const name = String(payload?.name ?? '').slice(0, 20) || 'Player';
    const room = rooms.create();
    if (payload?.rules) room.updateRules(sanitizeRules(payload.rules));
    const { token, seat } = room.join(name, socket.id);
    sessions.set(socket.id, { roomCode: room.code, token });
    ack({ ok: true, roomCode: room.code, token, seat });
    room.broadcast();
  }));

  socket.on('joinRoom', handler('joinRoom', (payload, ack) => {
    const code = String(payload?.roomCode ?? '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      ack(fail('No room with that code'));
      return;
    }
    const name = String(payload?.name ?? '').slice(0, 20) || 'Player';
    const known = payload?.token ? room.game.playerByToken(payload.token) : undefined;
    if (!known && room.isFull && room.game.phase !== 'lobby') {
      ack(fail('That table is full and already playing'));
      return;
    }
    const { token, seat } = room.join(name, socket.id, payload?.token);
    sessions.set(socket.id, { roomCode: room.code, token });
    ack({ ok: true, roomCode: room.code, token, seat });
    room.broadcast();
    room.pumpBots();
  }));

  socket.on('leaveRoom', handler('leaveRoom', (ack) => {
    const found = sessionRoom(socket.id);
    if (found) {
      found.room.disconnect(socket.id);
      found.room.broadcast();
    }
    sessions.delete(socket.id);
    ack?.({ ok: true });
  }));

  socket.on('updateRules', handler('updateRules', (payload, ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    if (!found.room.isHost(found.session.token)) return ack?.(fail('Only the host can change rules'));
    if (found.room.game.phase !== 'lobby') return ack?.(fail('Rules are locked once play starts'));
    found.room.updateRules(payload?.rules ?? {});
    found.room.broadcast();
    ack?.({ ok: true });
  }));

  socket.on('addBot', handler('addBot', (ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    if (!found.room.isHost(found.session.token)) return ack?.(fail('Only the host can add bots'));
    if (found.room.game.phase !== 'lobby') return ack?.(fail('Play has already started'));
    if (!found.room.addBot()) return ack?.(fail('The table is full'));
    found.room.broadcast();
    ack?.({ ok: true });
  }));

  socket.on('removeBot', handler('removeBot', (payload, ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    if (!found.room.isHost(found.session.token)) return ack?.(fail('Only the host can remove bots'));
    if (!found.room.removeBot(Number(payload?.seat))) return ack?.(fail('That seat is not a bot'));
    found.room.broadcast();
    ack?.({ ok: true });
  }));

  socket.on('startGame', handler('startGame', (ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    const { room, session } = found;
    if (!room.isHost(session.token)) return ack?.(fail('Only the host can start'));
    // A finished game can be restarted directly, so "play again" does not have
    // to detour through the lobby.
    if (room.game.phase !== 'lobby' && room.game.phase !== 'gameOver') {
      return ack?.(fail('Already playing'));
    }
    if (room.game.players.length !== SEAT_COUNT) {
      return ack?.(fail(`Need ${SEAT_COUNT} players — add bots to fill the table`));
    }
    room.game.startGame();
    room.broadcast();
    room.pumpBots();
    ack?.({ ok: true });
  }));

  socket.on('returnToLobby', handler('returnToLobby', (ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    const { room, session } = found;
    if (!room.isHost(session.token)) {
      return ack?.(fail('Only the host can return the table to the lobby'));
    }
    const res = room.game.returnToLobby();
    if (!res.ok) return ack?.(fail(res.error));
    room.broadcast();
    ack?.({ ok: true });
  }));

  socket.on('act', handler('act', (payload, ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    const player = found.room.game.playerByToken(found.session.token);
    if (!player) return ack?.(fail('You are spectating'));
    const res = found.room.game.act(player.seat, String(payload?.actionId ?? ''));
    if (!res.ok) return ack?.(fail(res.error));
    found.room.broadcast();
    found.room.pumpBots();
    ack?.({ ok: true });
  }));

  socket.on('discard', handler('discard', (payload, ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    const player = found.room.game.playerByToken(found.session.token);
    if (!player) return ack?.(fail('You are spectating'));
    const res = found.room.game.discard(player.seat, Number(payload?.tile));
    if (!res.ok) return ack?.(fail(res.error));
    found.room.broadcast();
    found.room.pumpBots();
    ack?.({ ok: true });
  }));

  socket.on('readyForNextHand', handler('readyForNextHand', (ack) => {
    const found = sessionRoom(socket.id);
    if (!found) return ack?.(fail('Not in a room'));
    const player = found.room.game.playerByToken(found.session.token);
    if (!player) return ack?.(fail('You are spectating'));
    const res = found.room.game.readyForNextHand(player.seat);
    if (!res.ok) return ack?.(fail(res.error));
    found.room.broadcast();
    found.room.pumpBots();
    ack?.({ ok: true });
  }));

  socket.on('disconnect', () => {
    const found = sessionRoom(socket.id);
    if (found) {
      found.room.disconnect(socket.id);
      found.room.broadcast();
    }
    sessions.delete(socket.id);
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.use(express.static(clientDist));
// Single-page app: hand any unmatched GET back to the client bundle.
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run: npm run build');
  });
});

setInterval(() => rooms.sweep(), 1000 * 60 * 10).unref();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
httpServer.listen(port, host, () => {
  console.log(`Taiwanese mahjong server listening on http://${host}:${port}`);
});
