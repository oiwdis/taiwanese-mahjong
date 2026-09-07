/**
 * End-to-end smoke test against a running server.
 *
 * Exercises the socket protocol the way the client does: create a table, fill
 * it with bots, start, then play until a hand finishes, always choosing
 * explicitly. Run the server first, then: npm run smoke -w @mahjong/server
 */
import { pathToFileURL } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import {
  cornerLabelOf,
  countsFromTiles,
  discardOptions,
  type PlayerView,
  type Tile,
} from '@mahjong/shared';

/**
 * Pick the discard that keeps the hand closest to a win.
 *
 * Throwing the lowest tile every turn never gets near tenpai, so a client that
 * plays that way never gets offered a win and cannot exercise the decline path.
 */
function bestDiscard(view: PlayerView): Tile | undefined {
  const legal = new Set(view.decision?.discardable ?? []);
  if (legal.size === 0) return undefined;
  const melds = view.you === null ? 0 : (view.players[view.you]?.melds.length ?? 0);
  for (const option of discardOptions(countsFromTiles(view.hand), melds)) {
    if (legal.has(option.tile)) return option.tile;
  }
  return view.decision?.discardable[0];
}

const URL = process.env.SMOKE_URL ?? 'http://localhost:3000';

function call<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} never acked`)), 5000);
    const args = payload === undefined ? [] : [payload];
    socket.emit(event, ...args, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function ok(label: string, res: unknown): void {
  const failed = res && typeof res === 'object' && 'ok' in res && res.ok === false;
  console.log(`${failed ? 'FAIL' : 'ok  '}  ${label}: ${JSON.stringify(res)}`);
  if (failed) throw new Error(`${label} failed`);
}

async function main(): Promise<void> {
  const socket = io(URL, { transports: ['websocket'] });
  const box: { view: PlayerView | null } = { view: null };
  socket.on('view', (v: PlayerView) => {
    box.view = v;
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  console.log('ok    connected');

  const created = await call<{ ok: true; roomCode: string }>(socket, 'createRoom', {
    name: 'Smoke',
  });
  ok('createRoom', created);

  for (let i = 0; i < 3; i++) {
    ok(`addBot ${i + 1}`, await call(socket, 'addBot'));
  }
  console.log(`      seats now: ${box.view?.players.length}`);
  if (box.view?.players.length !== 4) throw new Error('bots were not seated');

  ok('startGame', await call(socket, 'startGame'));

  // Play until a hand finishes, always making an explicit choice.
  const seen = new Set<string>();
  let moves = 0;
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    const v = box.view;
    if (!v) continue;

    if (v.phase === 'handOver' || v.phase === 'gameOver') {
      console.log(`\n      hand finished: ${v.result?.summary}`);
      if (v.result?.scored) {
        for (const item of v.result.scored.items) {
          console.log(`        ${item.chinese} (${item.english}) ${item.tai} tai`);
        }
      }
      for (const line of v.result?.lines ?? []) {
        console.log(
          `        seat ${line.from} pays seat ${line.to}: ${line.amount} (${line.tai} tai)`,
        );
      }
      break;
    }

    if (!v.decision) continue;

    for (const action of v.decision.actions) {
      if (!seen.has(action.label)) {
        seen.add(action.label);
        console.log(`      offered: "${action.label}"${action.armsPassedWater ? ' [arms 過水]' : ''}`);
      }
    }

    // Take a win if offered; otherwise pass on calls and discard on our turn.
    const win = v.decision.actions.find((a) => a.type === 'win' || a.type === 'flowerWin');
    if (win) {
      console.log(`      taking: ${win.label}`);
      ok('act win', await call(socket, 'act', { actionId: win.id }));
      moves++;
      continue;
    }

    if (v.decision.canDiscard) {
      const tile = bestDiscard(v)!;
      ok(`discard ${cornerLabelOf(tile)}`, await call(socket, 'discard', { tile }));
      moves++;
      continue;
    }

    const pass = v.decision.actions.find((a) => a.type === 'pass');
    if (pass) {
      ok('act pass', await call(socket, 'act', { actionId: pass.id }));
      moves++;
    }
  }

  console.log(`\n      moves made: ${moves}`);
  console.log(`      distinct action labels seen: ${seen.size}`);
  socket.close();
}

/**
 * Second pass: always decline the win, to walk the 過水 path over the wire.
 *
 * Bots never pass on a win, so this is the only way to see the lockout arm,
 * block later wins, and then clear.
 */
export async function declineEverything(): Promise<void> {
  const socket = io(URL, { transports: ['websocket'] });
  const box: { view: PlayerView | null } = { view: null };
  socket.on('view', (v: PlayerView) => {
    box.view = v;
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });

  ok('createRoom', await call(socket, 'createRoom', { name: 'Decliner' }));
  for (let i = 0; i < 3; i++) await call(socket, 'addBot');
  ok('startGame', await call(socket, 'startGame'));

  let declined = 0;
  let lockedOutSeen = false;
  let clearedSeen = false;
  let wasLockedOut = false;
  const deadline = Date.now() + 150000;
  let hands = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    const v = box.view;
    if (!v || v.you === null) continue;

    const me = v.players[v.you];
    if (me?.passedWater && !wasLockedOut) {
      wasLockedOut = true;
      lockedOutSeen = true;
      console.log('      過水 armed after declining a win');
    }
    if (wasLockedOut && me && !me.passedWater) {
      wasLockedOut = false;
      clearedSeen = true;
      console.log('      過水 cleared after passing a hand');
    }

    if (v.phase === 'gameOver') break;
    if (v.phase === 'handOver') {
      hands++;
      await call(socket, 'readyForNextHand');
      continue;
    }
    if (!v.decision) continue;

    // While locked out, the server must never offer a win.
    if (me?.passedWater) {
      const offered = v.decision.actions.some((a) => a.type === 'win');
      if (offered) throw new Error('a win was offered to a 過水 player');
      if (v.decision.decliningWinArmsPassedWater) {
        throw new Error('a 過水 player was told they could win');
      }
    }

    const win = v.decision.actions.find((a) => a.type === 'win');
    const pass = v.decision.actions.find((a) => a.type === 'pass');

    if (win && pass) {
      if (!pass.armsPassedWater) throw new Error('pass on a win was not flagged');
      console.log(`      declining: ${win.label} -> "${pass.label}"`);
      await call(socket, 'act', { actionId: pass.id });
      declined++;
      continue;
    }

    if (v.decision.canDiscard) {
      // Declining a self-draw by throwing a tile instead.
      if (v.decision.decliningWinArmsPassedWater) {
        console.log('      declining a self-draw by discarding instead');
        declined++;
      }
      const tile = bestDiscard(v);
      if (tile === undefined) {
        throw new Error(`canDiscard with nothing discardable (reason ${v.decision.reason})`);
      }
      await call(socket, 'discard', { tile });
      continue;
    }

    if (pass) ok(`pass (${v.decision.reason})`, await call(socket, 'act', { actionId: pass.id }));
  }

  console.log(`\n      hands played: ${hands}`);
  console.log(`      wins declined: ${declined}`);
  console.log(`      過水 armed at least once: ${lockedOutSeen}`);
  console.log(`      過水 cleared at least once: ${clearedSeen}`);
  socket.close();

  if (!lockedOutSeen) throw new Error('never managed to arm 過水');
  if (!clearedSeen) throw new Error('過水 never cleared');
}

/**
 * Third pass: finish a game, then exercise both ways out of it.
 *
 * Capped at a single hand so the game ends immediately, which is the only
 * practical way to reach `gameOver` over the wire in a smoke test.
 */
export async function afterTheGame(): Promise<void> {
  const socket = io(URL, { transports: ['websocket'] });
  const box: { view: PlayerView | null } = { view: null };
  socket.on('view', (v: PlayerView) => {
    box.view = v;
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });

  ok(
    'createRoom',
    await call(socket, 'createRoom', {
      name: 'Finisher',
      rules: { rounds: 1, maxHandsPerGame: 1 },
    }),
  );
  for (let i = 0; i < 3; i++) await call(socket, 'addBot');
  ok('startGame', await call(socket, 'startGame'));

  // Play the single hand out, then acknowledge the summary to end the game.
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    const v = box.view;
    if (!v) continue;
    if (v.phase === 'gameOver') break;
    if (v.phase === 'handOver') {
      await call(socket, 'readyForNextHand');
      continue;
    }
    if (!v.decision) continue;

    const win = v.decision.actions.find((a) => a.type === 'win' || a.type === 'flowerWin');
    if (win) {
      await call(socket, 'act', { actionId: win.id });
      continue;
    }
    if (v.decision.canDiscard) {
      const tile = bestDiscard(v);
      if (tile !== undefined) await call(socket, 'discard', { tile });
      continue;
    }
    const pass = v.decision.actions.find((a) => a.type === 'pass');
    if (pass) await call(socket, 'act', { actionId: pass.id });
  }

  if (box.view?.phase !== 'gameOver') throw new Error('never reached gameOver');
  console.log('      reached gameOver after 1 hand');
  const seatsAtEnd = box.view.players.map((p) => `${p.seat}:${p.name}`).join(', ');

  // Starting again straight from the finished game.
  ok('startGame off gameOver', await call(socket, 'startGame'));
  await new Promise((r) => setTimeout(r, 300));
  if (box.view?.phase === 'gameOver') throw new Error('a new game did not start');
  if (box.view?.handNumber !== 1) throw new Error(`expected hand 1, got ${box.view?.handNumber}`);
  for (const p of box.view!.players) {
    if (p.score !== 0) throw new Error(`${p.name} kept a score of ${p.score}`);
  }
  console.log('      "New game" dealt a fresh hand with the scores reset');

  // Finish that one too, then take the other exit: back to the lobby.
  const second = Date.now() + 120000;
  while (Date.now() < second) {
    await new Promise((r) => setTimeout(r, 100));
    const v = box.view;
    if (!v) continue;
    if (v.phase === 'gameOver') break;
    if (v.phase === 'handOver') {
      await call(socket, 'readyForNextHand');
      continue;
    }
    if (!v.decision) continue;
    const win = v.decision.actions.find((a) => a.type === 'win' || a.type === 'flowerWin');
    if (win) {
      await call(socket, 'act', { actionId: win.id });
      continue;
    }
    if (v.decision.canDiscard) {
      const tile = bestDiscard(v);
      if (tile !== undefined) await call(socket, 'discard', { tile });
      continue;
    }
    const pass = v.decision.actions.find((a) => a.type === 'pass');
    if (pass) await call(socket, 'act', { actionId: pass.id });
  }

  if (box.view?.phase !== 'gameOver') throw new Error('second game never finished');
  ok('returnToLobby', await call(socket, 'returnToLobby'));
  await new Promise((r) => setTimeout(r, 300));

  const lobby = box.view!;
  if (lobby.phase !== 'lobby') throw new Error(`expected lobby, got ${lobby.phase}`);
  const seatsInLobby = lobby.players.map((p) => `${p.seat}:${p.name}`).join(', ');
  if (seatsInLobby !== seatsAtEnd) {
    throw new Error(`seats changed: "${seatsAtEnd}" became "${seatsInLobby}"`);
  }
  console.log(`      back in the lobby with the same four: ${seatsInLobby}`);

  // The lobby is only useful if it is a real lobby, so rules must be editable
  // again and the table must be startable.
  ok('updateRules in lobby', await call(socket, 'updateRules', { rules: { rounds: 2 } }));
  if (box.view?.rules.rounds !== 2) throw new Error('rule change did not take');
  ok('startGame from lobby', await call(socket, 'startGame'));
  if (box.view?.phase === 'lobby') throw new Error('game did not start from the lobby');
  console.log('      rules editable again, and the table starts a new game');

  socket.close();
}

export async function runAll(): Promise<void> {
  await main();
  console.log('\n--- second pass: declining every win ---');
  await declineEverything();
  console.log('\n--- third pass: finishing a game and starting over ---');
  await afterTheGame();
}

// Only run when invoked directly, so a single pass can be imported and run on
// its own without dragging the whole suite along.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runAll().then(
    () => {
      console.log('\nSmoke test passed.');
      process.exit(0);
    },
    (err) => {
      console.error(`\nSmoke test failed: ${err.message}`);
      process.exit(1);
    },
  );
}
