import {
  buildTileSet,
  countsFromTiles,
  discardOptions,
  mulberry32,
  shanten,
  shuffle,
} from '@mahjong/shared';

const rng = mulberry32(1);
const deck = buildTileSet(false);
const hands = Array.from({ length: 200 }, () =>
  countsFromTiles(shuffle(deck, rng).slice(0, 16)),
);

let t = Date.now();
for (const h of hands) shanten(h, 0);
const shantenMs = Date.now() - t;

const sample = hands.slice(0, 10);
t = Date.now();
for (const h of sample) discardOptions(h, 0);
const discardMs = Date.now() - t;

console.log(`shanten:        ${(shantenMs / hands.length).toFixed(3)} ms/call`);
console.log(`discardOptions: ${(discardMs / sample.length).toFixed(1)} ms/call`);
