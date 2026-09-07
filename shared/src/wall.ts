import { FLOWER_START, NUM_FLOWERS, NUM_KINDS, type Tile } from './tiles.js';

/** Deterministic PRNG so games can be replayed and tests are stable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** The full tile set: four of each meldable kind, plus one of each flower. */
export function buildTileSet(useFlowers: boolean): Tile[] {
  const tiles: Tile[] = [];
  for (let t = 0; t < NUM_KINDS; t++) {
    for (let i = 0; i < 4; i++) tiles.push(t);
  }
  if (useFlowers) {
    for (let i = 0; i < NUM_FLOWERS; i++) tiles.push(FLOWER_START + i);
  }
  return tiles;
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * The wall, modelled as a single array with a head and a tail.
 *
 * Normal draws come off the head. Kong and flower replacements come off the
 * tail (嶺上牌), which is how the physical game works and which means a kong
 * does not shorten the number of turns remaining.
 */
export class Wall {
  private tiles: Tile[];
  private head = 0;
  private tail: number;

  constructor(tiles: Tile[]) {
    this.tiles = tiles;
    this.tail = tiles.length - 1;
  }

  static create(useFlowers: boolean, seed: number): Wall {
    return new Wall(shuffle(buildTileSet(useFlowers), mulberry32(seed)));
  }

  /** Tiles still available to draw, from either end. */
  get remaining(): number {
    return this.tail - this.head + 1;
  }

  get isEmpty(): boolean {
    return this.remaining <= 0;
  }

  /** Draw for a normal turn. */
  draw(): Tile {
    if (this.isEmpty) throw new Error('Wall exhausted');
    return this.tiles[this.head++]!;
  }

  /** Draw a replacement for a kong or a flower. */
  drawReplacement(): Tile {
    if (this.isEmpty) throw new Error('Wall exhausted');
    return this.tiles[this.tail--]!;
  }
}
