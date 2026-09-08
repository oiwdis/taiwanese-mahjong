/**
 * A dropped socket must be able to sit back down in the same seat.
 *
 * Socket.IO issues a new id after every disconnect. The room keeps the player
 * by token; join() and restoreHandshake() remap the new socket onto that seat.
 */
import { describe, expect, it } from 'vitest';
import { Room, RoomManager } from '../rooms.js';

describe('reclaiming a seat after a disconnect', () => {
  it('marks the player away, then sits them back in the same seat', () => {
    const room = new Room('ABCD', () => {});
    const first = room.join('Ada', 'sock-1');
    expect(first.seat).toBe(0);

    room.disconnect('sock-1');
    expect(room.game.players[0]!.connected).toBe(false);

    const again = room.join('Ada', 'sock-2', first.token);
    expect(again).toEqual({ token: first.token, seat: 0 });
    expect(room.game.players[0]!.connected).toBe(true);
    expect(room.game.players).toHaveLength(1);
  });

  it('does not drop the new socket when the old disconnect arrives late', () => {
    const room = new Room('ABCD', () => {});
    const first = room.join('Ada', 'sock-1');
    room.join('Ada', 'sock-2', first.token);

    room.disconnect('sock-1');

    expect(room.game.players[0]!.connected).toBe(true);
    room.disconnect('sock-2');
    expect(room.game.players[0]!.connected).toBe(false);
  });
});

describe('restoreHandshake', () => {
  it('remaps a new socket onto the stored seat', () => {
    const rooms = new RoomManager(() => {});
    const room = rooms.create();
    const seated = room.join('Ada', 'sock-1');

    room.disconnect('sock-1');
    const restored = rooms.restoreHandshake('sock-2', {
      roomCode: room.code,
      token: seated.token,
      name: 'Ada',
    });

    expect(restored).not.toBeNull();
    expect(restored?.token).toBe(seated.token);
    expect(room.game.players[0]!.connected).toBe(true);
  });

  it('ignores a token the table does not know', () => {
    const rooms = new RoomManager(() => {});
    const room = rooms.create();
    room.join('Ada', 'sock-1');

    expect(
      rooms.restoreHandshake('sock-2', {
        roomCode: room.code,
        token: 'never-issued',
        name: 'Ada',
      }),
    ).toBeNull();
    expect(room.game.players).toHaveLength(1);
  });

  it('ignores a kicked token', () => {
    const rooms = new RoomManager(() => {});
    const room = rooms.create();
    room.join('Host', 'sock-host');
    const guest = room.join('Guest', 'sock-guest');
    expect(room.kick(1).ok).toBe(true);

    expect(
      rooms.restoreHandshake('sock-new', {
        roomCode: room.code,
        token: guest.token,
        name: 'Guest',
      }),
    ).toBeNull();
  });
});
