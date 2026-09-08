/**
 * The host can remove another seated player from the lobby.
 */
import { describe, expect, it } from 'vitest';
import { Room } from '../rooms.js';

function openTable(): Room {
  const room = new Room('TEST', () => {});
  room.join('Host', 'socket-host');
  room.join('Guest', 'socket-guest');
  return room;
}

describe('kicking a player', () => {
  it('lets the host remove a human from the lobby and remaps seats', () => {
    const room = openTable();
    room.join('Third', 'socket-third');
    expect(room.game.players.map((p) => p.name)).toEqual(['Host', 'Guest', 'Third']);

    const res = room.kick(1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.name).toBe('Guest');
      expect(res.socketId).toBe('socket-guest');
    }
    expect(room.game.players.map((p) => ({ seat: p.seat, name: p.name }))).toEqual([
      { seat: 0, name: 'Host' },
      { seat: 1, name: 'Third' },
    ]);
  });

  it('refuses to kick the host', () => {
    const room = openTable();
    const res = room.kick(0);
    expect(res).toEqual({ ok: false, error: 'You cannot kick yourself' });
    expect(room.game.players).toHaveLength(2);
  });

  it('refuses once play has started', () => {
    const room = openTable();
    room.addBot();
    room.addBot();
    room.game.startGame();
    const res = room.kick(1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/lobby/i);
    expect(room.game.players).toHaveLength(4);
  });

  it('blocks the kicked token from sitting back down', () => {
    const room = openTable();
    const guest = room.game.players[1]!;
    expect(room.kick(1).ok).toBe(true);
    expect(room.wasKicked(guest.token)).toBe(true);
    expect(room.game.playerByToken(guest.token)).toBeUndefined();
  });

  it('also removes a bot through the same path', () => {
    const room = openTable();
    room.addBot();
    const botSeat = room.game.players.find((p) => p.isBot)!.seat;
    expect(room.removeBot(botSeat)).toBe(true);
    expect(room.game.players.some((p) => p.isBot)).toBe(false);
  });
});

describe('replacing an away player with a bot', () => {
  function playingTable(): Room {
    const room = openTable();
    room.addBot();
    room.addBot();
    room.game.startGame();
    return room;
  }

  it('turns a disconnected human into a bot in the same seat', () => {
    const room = playingTable();
    const guest = room.game.players[1]!;
    const oldToken = guest.token;
    room.game.markDisconnected(1);

    const res = room.replaceAwayWithBot(1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.name).toBe('Guest');

    const seat = room.game.players[1]!;
    expect(seat.isBot).toBe(true);
    expect(seat.connected).toBe(true);
    expect(seat.name).toBe('Guest');
    expect(seat.token).not.toBe(oldToken);
    expect(room.wasKicked(oldToken)).toBe(true);
    expect(room.game.players).toHaveLength(4);
    expect(room.game.log.some((line) => line.includes('a bot took that seat'))).toBe(true);
  });

  it('refuses while they are still connected', () => {
    const room = playingTable();
    const res = room.replaceAwayWithBot(1);
    expect(res).toEqual({ ok: false, error: 'They are still at the table' });
    expect(room.game.players[1]!.isBot).toBe(false);
  });

  it('refuses in the lobby', () => {
    const room = openTable();
    room.game.markDisconnected(1);
    const res = room.replaceAwayWithBot(1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/lobby/i);
  });

  it('still refuses a lobby-style kick once play has started', () => {
    const room = playingTable();
    room.game.markDisconnected(1);
    const res = room.kick(1);
    expect(res.ok).toBe(false);
    expect(room.game.players).toHaveLength(4);
  });
});
