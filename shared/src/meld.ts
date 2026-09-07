import type { Tile } from './tiles.js';

export type MeldKind = 'chow' | 'pung' | 'kong';

/**
 * A set that has been formed on the table (or a concealed kong, which is
 * declared but stays face down).
 *
 * `tile` is the lowest tile of a chow, or the repeated tile of a pung/kong.
 * `concealed` is only ever true for a concealed kong (暗槓); it is what lets a
 * hand keep 門清 while still having a declared kong.
 */
export interface Meld {
  kind: MeldKind;
  tile: Tile;
  concealed: boolean;
  /** Seat the claimed tile came from, when the set was called off a discard. */
  fromSeat?: number;
  /** The specific tile claimed, which matters for chows. */
  claimedTile?: Tile;
  /** True when a pung was later upgraded to a kong (加槓). */
  wasAddedKong?: boolean;
}

export function meldTiles(meld: Meld): Tile[] {
  switch (meld.kind) {
    case 'chow':
      return [meld.tile, meld.tile + 1, meld.tile + 2];
    case 'pung':
      return [meld.tile, meld.tile, meld.tile];
    case 'kong':
      return [meld.tile, meld.tile, meld.tile, meld.tile];
  }
}

/** Kongs and pungs both count as triplets for pattern purposes. */
export function isTripletMeld(meld: Meld): boolean {
  return meld.kind === 'pung' || meld.kind === 'kong';
}

/**
 * A triplet counts as 暗刻 when it was not formed by calling pung — so a
 * concealed kong qualifies but an exposed or added kong does not.
 */
export function isConcealedTriplet(meld: Meld): boolean {
  return meld.kind === 'kong' && meld.concealed;
}
