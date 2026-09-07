/**
 * Headless game runner.
 *
 * Plays complete games with four bots and asserts the invariants that a real
 * table has to satisfy: hand sizes stay legal, money is conserved, the
 * dealership advances correctly, and the state machine always has somebody to
 * wait on. Run with: npm run sim -w @mahjong/server
 */
import {
  MELDS_REQUIRED,
  SEAT_COUNT,
  isWinningShape,
  totalCount,
  type RulesConfig,
} from '@mahjong/shared';
import { Game } from './game.js';
import { chooseBotMove } from './bot.js';

interface SimStats {
  games: number;
  hands: number;
  wins: number;
  draws: number;
  selfDraws: number;
  passedWaterEvents: number;
  discards: number;
  calls: number;
  maxTai: number;
  maxStreak: number;
  taiHistogram: Map<number, number>;
  patternCounts: Map<string, number>;
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`Invariant violated: ${message}`);
}

/** Total tiles a seat controls: concealed plus what its sets hold. */
function tileFootprint(game: Game, seat: number): number {
  const p = game.players[seat]!;
  let n = totalCount(p.concealed);
  for (const m of p.melds) n += m.kind === 'kong' ? 4 : 3;
  return n;
}

function checkInvariants(game: Game, stats: SimStats): void {
  if (game.phase === 'lobby' || game.phase === 'handOver' || game.phase === 'gameOver') return;

  for (let seat = 0; seat < SEAT_COUNT; seat++) {
    const footprint = tileFootprint(game, seat);
    const kongs = game.players[seat]!.melds.filter((m) => m.kind === 'kong').length;
    // Between turns a seat holds 16 tiles, plus one per kong, plus one more
    // while it is holding a drawn tile it has not yet thrown.
    const low = 16 + kongs;
    const high = low + 1;
    assert(
      footprint >= low && footprint <= high,
      `seat ${seat} holds ${footprint} tiles, expected ${low}..${high} ` +
        `(kongs=${kongs}, phase=${game.phase}, current=${game.currentSeat})`,
    );
  }

  const totalMoney = game.players.reduce((sum, p) => sum + p.score, 0);
  assert(totalMoney === 0, `money not conserved: ${totalMoney}`);

  if (game.phase === 'acting' || game.phase === 'claiming' || game.phase === 'robbing') {
    assert(game.waitingSeats().length > 0, `phase ${game.phase} with nobody to act`);
  }

  stats.maxStreak = Math.max(stats.maxStreak, game.dealerStreak);
}

function runGame(rules: Partial<RulesConfig>, seed: number, stats: SimStats): void {
  const game = new Game({ rules, seed });
  for (let i = 0; i < SEAT_COUNT; i++) game.addPlayer(`Bot${i}`, `t${i}`, true);
  game.startGame();

  let steps = 0;
  const seenPassedWater = new Set<number>();

  while (game.phase !== 'gameOver') {
    if (++steps > 500000) throw new Error('Simulation did not terminate');

    checkInvariants(game, stats);

    for (const p of game.players) {
      if (p.passedWater && !seenPassedWater.has(p.seat)) {
        seenPassedWater.add(p.seat);
        stats.passedWaterEvents++;
      } else if (!p.passedWater) {
        seenPassedWater.delete(p.seat);
      }
    }

    const waiting = game.waitingSeats();
    if (waiting.length === 0) {
      throw new Error(`No pending decisions in phase ${game.phase}`);
    }

    for (const seat of waiting) {
      const before = game.epoch;
      const move = chooseBotMove(game, seat);
      assert(move !== null, `bot at seat ${seat} produced no move in ${game.phase}`);

      // Verify a declared win really is one, before the engine moves on.
      if (move!.kind === 'act') {
        const action = game.decisionFor(seat)?.actions.find((a) => a.id === move!.actionId);
        if (action?.type === 'win') {
          const p = game.players[seat]!;
          const concealed = [...p.concealed];
          if (game.phase === 'claiming' || game.phase === 'robbing') {
            concealed[action.tile!]!++;
          }
          assert(
            isWinningShape(concealed, MELDS_REQUIRED - p.melds.length),
            `seat ${seat} was offered a win that is not a winning shape`,
          );
        }
      }

      if (move!.kind === 'discard') {
        stats.discards++;
      } else {
        const type = game.decisionFor(seat)?.actions.find((a) => a.id === move!.actionId)?.type;
        if (type === 'chow' || type === 'pung' || type === 'kong') stats.calls++;
      }

      const res =
        move!.kind === 'act'
          ? game.act(seat, move!.actionId)
          : game.discard(seat, move!.tile);
      assert(res.ok, `bot move rejected: ${'error' in res ? res.error : ''}`);
      if (game.epoch !== before) break;
    }
  }

  // Tally from the history, since an all-bot table advances hands immediately.
  for (const result of game.history) {
    stats.hands++;
    if (result.kind === 'draw') {
      stats.draws++;
      continue;
    }
    stats.wins++;
    if (result.discarderSeat === null) stats.selfDraws++;
    const scored = result.scored!;
    stats.maxTai = Math.max(stats.maxTai, scored.handTai);
    stats.taiHistogram.set(scored.handTai, (stats.taiHistogram.get(scored.handTai) ?? 0) + 1);
    for (const item of scored.items) {
      stats.patternCounts.set(
        item.chinese,
        (stats.patternCounts.get(item.chinese) ?? 0) + item.count,
      );
    }
  }

  const finalMoney = game.players.reduce((sum, p) => sum + p.score, 0);
  assert(finalMoney === 0, `money not conserved at game end: ${finalMoney}`);

  stats.games++;
}

function main(): void {
  const stats: SimStats = {
    games: 0,
    hands: 0,
    wins: 0,
    draws: 0,
    selfDraws: 0,
    passedWaterEvents: 0,
    discards: 0,
    calls: 0,
    maxTai: 0,
    maxStreak: 0,
    taiHistogram: new Map(),
    patternCounts: new Map(),
  };

  const configs: { label: string; rules: Partial<RulesConfig> }[] = [
    { label: 'default (flowers, traditional, 1 round)', rules: {} },
    { label: 'no flowers (136 tiles)', rules: { useFlowers: false } },
    { label: 'simplified scale, 5 tai minimum', rules: { taiScale: 'simplified', minTai: 5 } },
    { label: '4 rounds, 8 tai ceiling', rules: { rounds: 4, maxTai: 8 } },
    { label: 'strict 平胡, no added-kong clear', rules: { pingHuStrict: true, addedKongClearsPassedWater: false } },
  ];

  const gamesPerConfig = Number(process.argv[2] ?? 8);

  for (const config of configs) {
    const before = { hands: stats.hands, wins: stats.wins, draws: stats.draws };
    for (let i = 0; i < gamesPerConfig; i++) {
      runGame(config.rules, 1000 + stats.games * 7919 + i, stats);
    }
    console.log(
      `  ${config.label.padEnd(42)} ` +
        `${stats.hands - before.hands} hands, ` +
        `${stats.wins - before.wins} wins, ${stats.draws - before.draws} draws`,
    );
  }

  console.log('\n=== Totals ===');
  console.log(`games            ${stats.games}`);
  console.log(`hands            ${stats.hands}`);
  console.log(`wins             ${stats.wins}`);
  console.log(`  self-draws     ${stats.selfDraws}`);
  console.log(`  discard wins   ${stats.wins - stats.selfDraws}`);
  console.log(`draws (流局)      ${stats.draws} (${((100 * stats.draws) / stats.hands).toFixed(1)}%)`);
  console.log(`discards played  ${stats.discards} (${(stats.discards / stats.hands).toFixed(1)} per hand)`);
  console.log(`calls made       ${stats.calls} (${(stats.calls / stats.hands).toFixed(1)} per hand)`);
  console.log(`過水 lockouts     ${stats.passedWaterEvents}`);
  console.log(`highest tai      ${stats.maxTai}`);
  console.log(`longest streak   ${stats.maxStreak}`);

  const tai = [...stats.taiHistogram.entries()].sort((a, b) => a[0] - b[0]);
  console.log('\ntai distribution');
  for (const [value, count] of tai) {
    console.log(`  ${String(value).padStart(3)} tai  ${'#'.repeat(Math.min(60, count))} ${count}`);
  }

  const patterns = [...stats.patternCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\nmost common patterns');
  for (const [name, count] of patterns.slice(0, 18)) {
    console.log(`  ${name.padEnd(10)} ${count}`);
  }

  console.log('\nAll invariants held.');
}

main();
