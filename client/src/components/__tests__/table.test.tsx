/**
 * Structural checks on the round table.
 *
 * Rendered to static markup rather than driven in a real browser, so these
 * assert what is in the DOM (how many wall tiles, which river a discard lands
 * in) rather than how it looks. Layout itself is CSS and is not covered here.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RULES,
  parseTiles,
  type HandResult,
  type PlayerView,
  type PublicPlayer,
} from '@mahjong/shared';
import { HandSummary } from '../HandSummary.js';

// Importing the table pulls in the socket module, which opens a connection on
// import. Nothing here sends anything, so stub it out.
vi.mock('../../socket.js', () => ({
  api: {},
  socket: { on: () => {}, off: () => {}, emit: () => {} },
}));

const { Table, memoOf, movesBetween } = await import('../Table.js');

function player(seat: number, over: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    seat,
    name: `P${seat}`,
    isBot: seat !== 0,
    connected: true,
    score: 0,
    concealedCount: 16,
    melds: [],
    flowers: [],
    discards: [],
    seatWind: seat,
    isDealer: seat === 0,
    passedWater: false,
    thinking: false,
    readyForNext: false,
    ...over,
  };
}

function view(over: Partial<PlayerView> = {}): PlayerView {
  return {
    roomCode: 'TEST',
    phase: 'acting',
    rules: DEFAULT_RULES,
    hostSeat: 0,
    you: 0,
    players: [player(0), player(1), player(2), player(3)],
    hand: parseTiles('123m 456m 789m 234p 567p 55s'),
    drawnTile: null,
    roundWind: 0,
    roundNumber: 1,
    handNumber: 1,
    dealerSeat: 0,
    dealerStreak: 0,
    currentSeat: 0,
    wallRemaining: 144,
    liveWallRemaining: 128,
    lastDiscard: null,
    pendingKong: null,
    waitingOn: [0],
    decision: null,
    analysis: null,
    result: null,
    log: [],
    ...over,
  };
}

/** Count non-overlapping occurrences of a class in the markup. */
function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

function render(v: PlayerView): string {
  return renderToStaticMarkup(<Table view={v} />);
}

describe('leaving the table', () => {
  it('shows Exit game when an exit handler is provided', () => {
    const html = renderToStaticMarkup(<Table view={view()} onExit={() => {}} />);
    expect(html).toContain('Exit game');
  });

  it('lets the host replace an away player with a bot', () => {
    const html = render(
      view({
        hostSeat: 0,
        you: 0,
        players: [
          player(0),
          player(1, { isBot: false, connected: false }),
          player(2, { isBot: true }),
          player(3, { isBot: true }),
        ],
      }),
    );
    expect(html).toContain('Replace with bot');
    expect(html).toContain('away');
  });

  it('hides the replace button from other seats', () => {
    const html = render(
      view({
        hostSeat: 0,
        you: 2,
        players: [
          player(0),
          player(1, { connected: false }),
          player(2),
          player(3),
        ],
      }),
    );
    expect(html).not.toContain('Replace with bot');
  });
});

describe('your hand', () => {
  it('starts sorted and can be dragged', () => {
    const html = render(view({ hand: parseTiles('9s 1m 5p') }));
    const start = html.indexOf('my-hand');
    const slice = html.slice(start, html.indexOf('action-bar', start));
    const labels = [...slice.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(['1 Characters', '5 Dots', '9 Bamboo']);
    expect(slice).toContain('tile-sortable');
  });
});

describe('the wall on the table', () => {
  it('is four sides of 18 stacks, two tiles high', () => {
    const html = render(view());

    // 144 tiles = 4 sides x 18 stacks x 2 high.
    expect(count(html, 'class="wall-stack"')).toBe(72);
    expect(count(html, 'wall-tile-upper')).toBe(72);
    expect(count(html, 'wall-tile-lower')).toBe(72);

    for (const side of ['north', 'east', 'south', 'west']) {
      const from = html.indexOf(`wall-side-${side}`);
      expect(from, `${side} side is missing`).toBeGreaterThan(-1);
      const slice = html.slice(from, html.indexOf('wall-side', from + 20));
      expect(count(slice, 'class="wall-stack"')).toBe(18);
    }
  });

  it('shortens to 17 stacks a side when flowers are off', () => {
    // 136 tiles without the 8 flowers, which is 4 x 17 x 2.
    const html = render(view({ rules: { ...DEFAULT_RULES, useFlowers: false } }));
    expect(count(html, 'class="wall-stack"')).toBe(68);
  });

  it('greys out the dead wall that can never be drawn', () => {
    const html = render(view());
    expect(count(html, 'wall-tile-dead')).toBe(DEFAULT_RULES.wallDeadTiles);
  });

  it('empties stacks as the wall is drawn down', () => {
    const full = render(view({ wallRemaining: 144 }));
    expect(count(full, 'wall-tile-taken')).toBe(0);

    // Sixteen tiles gone means eight whole stacks are clear.
    const used = render(view({ wallRemaining: 128 }));
    expect(count(used, 'wall-tile-taken')).toBe(16);

    const nearlyOut = render(view({ wallRemaining: 20 }));
    expect(count(nearlyOut, 'wall-tile-taken')).toBe(124);
  });
});

describe('discards land in front of their owner', () => {
  it('gives every seat its own river, placed by where they sit', () => {
    const html = render(view());
    for (const pos of ['river-south', 'river-east', 'river-north', 'river-west']) {
      expect(count(html, pos), pos).toBe(1);
    }
  });

  it('puts a nameplate on the south rim so the wall is not a stray hand', () => {
    const html = render(view());
    expect(html).toContain('seat-south');
    expect(html).toContain('seat-self');
    expect(html).toContain('P0 (you)');
    // Your real tiles live in the tray, not as face-down backs on the plate.
    const south = html.slice(html.indexOf('seat-stack-south'), html.indexOf('flight-layer'));
    expect(south).not.toContain('tile-back');
  });

  it('lays opponent racks along the table edges', () => {
    const html = render(view());
    expect(html).toContain('rack-north');
    expect(html).toContain('rack-east');
    expect(html).toContain('rack-west');
    expect(html).not.toContain('rack-south');
  });

  it('puts a thrown tile in the thrower’s river, not the middle', () => {
    const thrown = parseTiles('3m')[0]!;
    const players = [player(0), player(1, { discards: [thrown] }), player(2), player(3)];
    // Seat 1 sits to your east.
    const html = render(view({ players, lastDiscard: { seat: 1, tile: thrown }, currentSeat: 2 }));

    const east = html.indexOf('river-east');
    const next = html.indexOf('<div class="river', east + 5);
    const eastRiver = html.slice(east, next === -1 ? undefined : next);
    expect(count(eastRiver, 'tile-suit-man')).toBe(1);
    expect(count(eastRiver, 'river-fresh')).toBe(1);
  });
});

describe('spotting which tiles moved', () => {
  // You sit south, so seat 1 is east, seat 2 north, seat 3 west.
  const posOf = (seat: number) => (['south', 'east', 'north', 'west'] as const)[seat % 4]!;

  it('animates nothing on the opening deal', () => {
    const first = view();
    expect(movesBetween(null, first, posOf)).toEqual([]);

    // A new hand deals 64 tiles at once; that is not a draw.
    const dealt = view({ handNumber: 2, wallRemaining: 75 });
    expect(movesBetween(memoOf(first), dealt, posOf)).toEqual([]);
  });

  it('reads a shrinking wall as a draw, face-up only for you', () => {
    const before = memoOf(view());
    const drawn = parseTiles('5p')[0]!;

    const mine = movesBetween(
      before,
      view({ wallRemaining: 143, currentSeat: 0, drawnTile: drawn }),
      posOf,
    );
    expect(mine).toEqual([{ kind: 'draw', pos: 'south', tile: drawn }]);

    // You cannot see what somebody else picked up.
    const theirs = movesBetween(
      before,
      view({ wallRemaining: 143, currentSeat: 2, drawnTile: null }),
      posOf,
    );
    expect(theirs).toEqual([{ kind: 'draw', pos: 'north', tile: null }]);
  });

  it('reads a growing river as a discard by that seat', () => {
    const before = memoOf(view());
    const thrown = parseTiles('7s')[0]!;
    const players = [player(0), player(1), player(2), player(3, { discards: [thrown] })];

    // Seat 3 sits west, so the tile flies out towards the west river.
    expect(movesBetween(before, view({ players }), posOf)).toEqual([
      { kind: 'discard', pos: 'west', tile: thrown },
    ]);
  });

  it('reports a draw and a discard together when both happened', () => {
    const before = memoOf(view());
    const thrown = parseTiles('2m')[0]!;
    const players = [player(0), player(1, { discards: [thrown] }), player(2), player(3)];

    const moves = movesBetween(
      before,
      view({ players, wallRemaining: 143, currentSeat: 2 }),
      posOf,
    );
    expect(moves).toEqual([
      { kind: 'draw', pos: 'north', tile: null },
      { kind: 'discard', pos: 'east', tile: thrown },
    ]);
  });

  it('stays quiet when nothing moved', () => {
    const same = view();
    expect(movesBetween(memoOf(same), same, posOf)).toEqual([]);
  });

  it('ignores a claimed tile leaving a river', () => {
    // A pung takes the tile back out of the discarder's river, which shrinks
    // it. That is not a discard and must not animate as one.
    const thrown = parseTiles('9s')[0]!;
    const before = memoOf(
      view({ players: [player(0), player(1, { discards: [thrown] }), player(2), player(3)] }),
    );
    expect(movesBetween(before, view(), posOf)).toEqual([]);
  });
});

describe('the claim window is visible', () => {
  const tile = parseTiles('9s')[0]!;
  const claiming = (over: Partial<PlayerView> = {}) =>
    view({
      phase: 'claiming',
      currentSeat: 1,
      players: [player(0), player(1, { discards: [tile] }), player(2), player(3)],
      lastDiscard: { seat: 1, tile },
      waitingOn: [0],
      ...over,
    });

  it('holds the table and marks the tile as claimable', () => {
    const html = render(
      claiming({
        decision: {
          reason: 'claim',
          actions: [
            { id: `pung:${tile}`, type: 'pung', tile, label: 'Pong 9s' },
            { id: 'pass', type: 'pass', label: 'Pass' },
          ],
          canDiscard: false,
          discardable: [],
          decliningWinArmsPassedWater: false,
          deadline: null,
        },
      }),
    );

    expect(html).toContain('round-table-claiming');
    expect(html).toContain('river-claimable');
    expect(html).toContain('Claim window');
    expect(html).toContain('You can pong');
    expect(html).toContain('Pong 9s');
    expect(html).toContain('The table is holding for you');
    expect(html).toContain('claim-popup');
    expect(html).toContain('my-area-claim');
    expect(html.indexOf('claim-popup')).toBeLessThan(html.indexOf('my-area-claim'));
  });

  it('says who it is waiting on when the choice is not yours', () => {
    const html = render(claiming({ waitingOn: [2] }));
    expect(html).toContain('round-table-claiming');
    expect(html).toContain('waiting on P2');
    expect(html).not.toContain('my-area-claim');
  });

  it('shows the turn and the draws left when nothing is pending', () => {
    const html = render(view({ currentSeat: 2, liveWallRemaining: 57 }));
    expect(html).not.toContain('round-table-claiming');
    expect(html).toContain('57 draws left');
    expect(html).toContain('P2\u2019s turn');
  });
});

describe('concealed gangs', () => {
  it('shows the tile only to the owner', () => {
    const tile = parseTiles('5p')[0]!;
    const gang = { kind: 'kong' as const, tile, concealed: true };
    const hidden = render(
      view({
        you: 0,
        players: [
          player(0),
          player(1, { concealedCount: 12, melds: [gang] }),
          player(2),
          player(3),
        ],
      }),
    );
    const hiddenMeld = hidden.match(/<div class="meld meld-concealed">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(hiddenMeld).toContain('tile-back');
    expect(hiddenMeld).not.toContain('tile-suit-');

    const own = render(
      view({
        you: 0,
        players: [
          player(0, { concealedCount: 12, melds: [gang] }),
          player(1),
          player(2),
          player(3),
        ],
      }),
    );
    const ownMeld = own.match(/<div class="meld meld-concealed">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(ownMeld).toContain('tile-suit-pin');

    const ended = render(
      view({
        you: 0,
        phase: 'handOver',
        players: [
          player(0),
          player(1, { concealedCount: 12, melds: [gang] }),
          player(2),
          player(3),
        ],
      }),
    );
    const endedMeld = ended.match(/<div class="meld meld-concealed">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(endedMeld).toContain('tile-suit-pin');
  });
});

describe('the game over screen', () => {
  const finished = (over: Partial<PlayerView> = {}) =>
    view({
      phase: 'gameOver',
      handNumber: 9,
      players: [
        player(0, { score: 240 }),
        player(1, { score: -80 }),
        player(2, { score: -100 }),
        player(3, { score: -60 }),
      ],
      waitingOn: [],
      ...over,
    });

  it('offers the host both a new game and a way back to the lobby', () => {
    const html = render(finished({ you: 0, hostSeat: 0 }));
    expect(html).toContain('Game over');
    expect(html).toContain('New game');
    expect(html).toContain('Back to lobby');
    expect(html).toContain('Everyone keeps their seat');
  });

  it('ranks the table by money, signed and marked', () => {
    const html = render(finished({ you: 0, hostSeat: 0 }));
    const board = html.slice(html.indexOf('class="scoreboard"'));

    // Ranked best first, with a sign on the winnings and your own row marked.
    const ranked = [...board.matchAll(/class="score-name">([^<]*(?:<[^>]*>[^<]*)*?)</g)].map((m) =>
      m[1]!.replace(/<[^>]*>/g, '').trim(),
    );
    expect(ranked).toEqual(['1. P0 (you)', '2. P3', '3. P1', '4. P2']);

    const totals = [...board.matchAll(/class="score-total[^"]*">([^<]+)</g)].map((m) => m[1]);
    expect(totals).toEqual(['+240', '-60', '-80', '-100']);

    expect(html).toContain('9 hands');
  });

  it('tells a non-host who they are waiting on instead of dead-ending', () => {
    const html = render(finished({ you: 2, hostSeat: 0 }));
    expect(html).toContain('Game over');
    expect(html).not.toContain('New game');
    expect(html).not.toContain('Back to lobby');
    expect(html).toContain('Waiting for P0');
  });
});

describe('next hand', () => {
  const result: HandResult = {
    kind: 'win',
    winnerSeat: 0,
    discarderSeat: 1,
    winningTile: parseTiles('5p')[0]!,
    revealedConcealed: [],
    scored: null,
    lines: [],
    deltas: [30, -10, -10, -10],
    summary: 'P0 won',
    dealerContinues: true,
  };

  it('says who it is still waiting on after you are ready', () => {
    const html = renderToStaticMarkup(
      <HandSummary
        view={view({
          phase: 'handOver',
          result,
          players: [
            player(0, { readyForNext: true }),
            player(1, { name: 'Sam', isBot: false }),
            player(2, { isBot: true, readyForNext: true }),
            player(3, { isBot: true, readyForNext: true }),
          ],
        })}
        result={result}
        onNext={() => {}}
      />,
    );
    expect(html).toContain('Waiting on Sam');
    expect(html).toContain('everyone is ready');
  });
});
