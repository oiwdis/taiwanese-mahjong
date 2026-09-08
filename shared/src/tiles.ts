/**
 * Tile model for Taiwanese (16-tile) mahjong.
 *
 * A tile "kind" is an integer 0..41:
 *
 *   0..8    characters  萬 (man)     1m..9m
 *   9..17   dots        筒 (pin)     1p..9p
 *   18..26  bamboo      索 (sou)     1s..9s
 *   27..30  winds       東南西北      E S W N
 *   31..33  dragons     中發白        R G Wh
 *   34..37  seasons     春夏秋冬      Sp Su Au Wi
 *   38..41  plants      梅蘭菊竹      Pl Or Ch Ba
 *
 * Kinds 0..33 are the 34 "playable" kinds that form melds (4 copies each = 136).
 * Kinds 34..41 are the 8 bonus/flower tiles (1 copy each), which never form part
 * of the 17-tile winning structure.
 */

export type Tile = number;

export const SUIT_SIZE = 9;

export const MAN_START = 0;
export const PIN_START = 9;
export const SOU_START = 18;
export const HONOR_START = 27;
export const WIND_START = 27;
export const DRAGON_START = 31;

/** Number of kinds that participate in melds. */
export const NUM_KINDS = 34;

export const FLOWER_START = 34;
export const SEASON_START = 34;
export const PLANT_START = 38;
export const NUM_FLOWERS = 8;
export const NUM_ALL_KINDS = 42;

export const DRAGON_RED = 31;
export const DRAGON_GREEN = 32;
export const DRAGON_WHITE = 33;

export const DRAGONS: readonly Tile[] = [DRAGON_RED, DRAGON_GREEN, DRAGON_WHITE];
export const WINDS: readonly Tile[] = [27, 28, 29, 30];

export type Suit = 'man' | 'pin' | 'sou' | 'wind' | 'dragon' | 'season' | 'plant';

export function suitOf(tile: Tile): Suit {
  if (tile < PIN_START) return 'man';
  if (tile < SOU_START) return 'pin';
  if (tile < HONOR_START) return 'sou';
  if (tile < DRAGON_START) return 'wind';
  if (tile < FLOWER_START) return 'dragon';
  if (tile < PLANT_START) return 'season';
  return 'plant';
}

/** 1..9 for suited tiles, 0 for honors and flowers. */
export function rankOf(tile: Tile): number {
  return isSuited(tile) ? (tile % SUIT_SIZE) + 1 : 0;
}

export function isSuited(tile: Tile): boolean {
  return tile >= 0 && tile < HONOR_START;
}

export function isHonor(tile: Tile): boolean {
  return tile >= HONOR_START && tile < FLOWER_START;
}

export function isWind(tile: Tile): boolean {
  return tile >= WIND_START && tile < DRAGON_START;
}

export function isDragon(tile: Tile): boolean {
  return tile >= DRAGON_START && tile < FLOWER_START;
}

export function isFlower(tile: Tile): boolean {
  return tile >= FLOWER_START && tile < NUM_ALL_KINDS;
}

/** Terminals are the 1 and 9 of each suit. */
export function isTerminal(tile: Tile): boolean {
  const r = rankOf(tile);
  return r === 1 || r === 9;
}

/** True when tile, tile+1, tile+2 form a valid run inside one suit. */
export function canStartRun(tile: Tile): boolean {
  return isSuited(tile) && tile % SUIT_SIZE <= SUIT_SIZE - 3;
}

/** True when tile and tile+1 are adjacent inside one suit. */
export function isAdjacentInSuit(tile: Tile): boolean {
  return isSuited(tile) && tile % SUIT_SIZE <= SUIT_SIZE - 2;
}

/**
 * The "own flower" tiles (正花) for a seat wind index 0..3 (E S W N).
 * East pairs with 春/梅, South with 夏/蘭, West with 秋/菊, North with 冬/竹.
 */
export function ownFlowersForSeat(seatWind: number): [Tile, Tile] {
  return [SEASON_START + seatWind, PLANT_START + seatWind];
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const UNICODE_BASE = {
  man: 0x1f007,
  sou: 0x1f010,
  pin: 0x1f019,
} as const;

/** Unicode Mahjong Tiles block glyph for a kind. */
export function glyphOf(tile: Tile): string {
  const suit = suitOf(tile);
  const rank = tile % SUIT_SIZE;
  switch (suit) {
    case 'man':
      return String.fromCodePoint(UNICODE_BASE.man + rank);
    case 'pin':
      return String.fromCodePoint(UNICODE_BASE.pin + rank);
    case 'sou':
      return String.fromCodePoint(UNICODE_BASE.sou + rank);
    case 'wind':
      // U+1F000 East .. U+1F003 North
      return String.fromCodePoint(0x1f000 + (tile - WIND_START));
    case 'dragon':
      // U+1F004 Red, U+1F005 Green, U+1F006 White. The red dragon defaults to
      // emoji presentation, so request text presentation explicitly.
      return String.fromCodePoint(0x1f004 + (tile - DRAGON_START)) + '\ufe0e';
    case 'season':
      // U+1F026 Spring .. U+1F029 Winter
      return String.fromCodePoint(0x1f026 + (tile - SEASON_START));
    case 'plant':
      // U+1F022 Plum, U+1F023 Orchid, U+1F024 Bamboo, U+1F025 Chrysanthemum.
      // Our order is 梅蘭菊竹, so chrysanthemum and bamboo are swapped.
      return [0x1f022, 0x1f023, 0x1f025, 0x1f024].map((cp) => String.fromCodePoint(cp))[
        tile - PLANT_START
      ]!;
  }
}

/** Chinese name, e.g. 一萬, 東, 紅中, 春. */
export function chineseNameOf(tile: Tile): string {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const suit = suitOf(tile);
  const rank = tile % SUIT_SIZE;
  switch (suit) {
    case 'man':
      return `${numerals[rank]}萬`;
    case 'pin':
      return `${numerals[rank]}筒`;
    case 'sou':
      return `${numerals[rank]}索`;
    case 'wind':
      return ['東', '南', '西', '北'][tile - WIND_START]!;
    case 'dragon':
      return ['紅中', '青發', '白板'][tile - DRAGON_START]!;
    case 'season':
      return ['春', '夏', '秋', '冬'][tile - SEASON_START]!;
    case 'plant':
      return ['梅', '蘭', '菊', '竹'][tile - PLANT_START]!;
  }
}

/**
 * Short Latin label drawn in the tile's corner.
 *
 *   suited   -> rank digit + suit letter, e.g. "1m", "5p", "9s"
 *   winds    -> E / S / W / N
 *   dragons  -> R (紅中) / G (青發) / Wh (白板); "Wh" avoids colliding with West
 *   seasons  -> Sp / Su / Au / Wi
 *   plants   -> Pl / Or / Ch / Ba
 */
export function cornerLabelOf(tile: Tile): string {
  const suit = suitOf(tile);
  switch (suit) {
    case 'man':
      return `${rankOf(tile)}m`;
    case 'pin':
      return `${rankOf(tile)}p`;
    case 'sou':
      return `${rankOf(tile)}s`;
    case 'wind':
      return ['E', 'S', 'W', 'N'][tile - WIND_START]!;
    case 'dragon':
      return ['R', 'G', 'Wh'][tile - DRAGON_START]!;
    case 'season':
      return ['Sp', 'Su', 'Au', 'Wi'][tile - SEASON_START]!;
    case 'plant':
      return ['Pl', 'Or', 'Ch', 'Ba'][tile - PLANT_START]!;
  }
}

/** Longer English name for tooltips and the score breakdown. */
export function englishNameOf(tile: Tile): string {
  const suit = suitOf(tile);
  switch (suit) {
    case 'man':
      return `${rankOf(tile)} Characters`;
    case 'pin':
      return `${rankOf(tile)} Dots`;
    case 'sou':
      return `${rankOf(tile)} Bamboo`;
    case 'wind':
      return ['East', 'South', 'West', 'North'][tile - WIND_START]!;
    case 'dragon':
      return ['Red Dragon', 'Green Dragon', 'White Dragon'][tile - DRAGON_START]!;
    case 'season':
      return ['Spring', 'Summer', 'Autumn', 'Winter'][tile - SEASON_START]!;
    case 'plant':
      return ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'][tile - PLANT_START]!;
  }
}

/** Compact notation used in tests and logs: "1m", "E", "R", "Sp". */
export function tileToString(tile: Tile): string {
  return cornerLabelOf(tile);
}

const STRING_TO_TILE = new Map<string, Tile>();
for (let t = 0; t < NUM_ALL_KINDS; t++) {
  STRING_TO_TILE.set(cornerLabelOf(t).toLowerCase(), t);
}

export function tileFromString(s: string): Tile {
  const t = STRING_TO_TILE.get(s.trim().toLowerCase());
  if (t === undefined) throw new Error(`Unknown tile: ${s}`);
  return t;
}

/**
 * Parse a compact hand description into a tile array.
 * Accepts runs like "123m 456p 77s EEE R" as well as comma separated forms.
 */
export function parseTiles(spec: string): Tile[] {
  const out: Tile[] = [];
  for (const token of spec.split(/[\s,]+/).filter(Boolean)) {
    const suited = /^(\d+)([mps])$/i.exec(token);
    if (suited) {
      const suitChar = suited[2]!.toLowerCase();
      for (const digit of suited[1]!) out.push(tileFromString(`${digit}${suitChar}`));
      continue;
    }
    // Repeated honors such as "EEE" or "RR". Two-character labels come first
    // so "Wh" is not consumed as "W" followed by an unparseable "h".
    const honors = /^(Wh|Sp|Su|Au|Wi|Pl|Or|Ch|Ba|E|S|W|N|R|G)+$/i.exec(token);
    if (honors) {
      const re = /Wh|Sp|Su|Au|Wi|Pl|Or|Ch|Ba|E|S|W|N|R|G/gi;
      for (const m of token.matchAll(re)) out.push(tileFromString(m[0]!));
      continue;
    }
    out.push(tileFromString(token));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Count vectors
// ---------------------------------------------------------------------------

/** A length-34 vector of how many of each meldable kind a hand holds. */
export type Counts = number[];

export function emptyCounts(): Counts {
  return new Array<number>(NUM_KINDS).fill(0);
}

export function countsFromTiles(tiles: readonly Tile[]): Counts {
  const counts = emptyCounts();
  for (const t of tiles) {
    if (isFlower(t)) continue;
    counts[t]!++;
  }
  return counts;
}

export function tilesFromCounts(counts: Counts): Tile[] {
  const out: Tile[] = [];
  for (let t = 0; t < NUM_KINDS; t++) {
    for (let i = 0; i < counts[t]!; i++) out.push(t);
  }
  return out;
}

export function totalCount(counts: Counts): number {
  let n = 0;
  for (let t = 0; t < NUM_KINDS; t++) n += counts[t]!;
  return n;
}

export function sortTiles(tiles: readonly Tile[]): Tile[] {
  return [...tiles].sort((a, b) => a - b);
}
