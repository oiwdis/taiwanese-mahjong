import { rankOf, suitOf, type Tile } from '@mahjong/shared';

const NUMERAL = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WIND = ['東', '南', '西', '北'];
const SEASON = ['春', '夏', '秋', '冬'];
const PLANT = ['梅', '蘭', '菊', '竹'];

function Pip({
  cx,
  cy,
  r,
  tone,
}: {
  cx: number;
  cy: number;
  r: number;
  tone: 'red' | 'green' | 'blue';
}) {
  return (
    <g>
      <circle className={`art-${tone}`} cx={cx} cy={cy} r={r} />
      <circle fill="var(--tile-face)" cx={cx - r * 0.28} cy={cy - r * 0.32} r={r * 0.22} />
    </g>
  );
}

function Stick({
  x,
  y,
  red = false,
  rotate = 0,
}: {
  x: number;
  y: number;
  red?: boolean;
  rotate?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect className={red ? 'art-red' : 'art-green'} x={-3.2} y={-12} width={6.4} height={24} rx={3.2} />
      <rect fill="var(--tile-face)" x={-0.9} y={-8} width={1.8} height={16} rx={0.8} />
    </g>
  );
}

function Dots({ tile }: { tile: Tile }) {
  const rank = rankOf(tile);
  if (rank === 1) {
    return (
      <g>
        <circle className="art-red" cx="32" cy="46" r="15" />
        <circle fill="var(--tile-face)" cx="32" cy="46" r="7.5" />
        <circle className="art-red" cx="32" cy="46" r="3.2" />
      </g>
    );
  }

  const green = 'green' as const;
  const blue = 'blue' as const;
  const red = 'red' as const;
  const r = rank >= 7 ? 4.2 : 5;

  const layouts: Record<number, Array<[number, number, 'red' | 'green' | 'blue']>> = {
    2: [
      [32, 32, green],
      [32, 60, green],
    ],
    3: [
      [22, 30, green],
      [32, 46, green],
      [42, 62, green],
    ],
    4: [
      [22, 32, blue],
      [42, 32, blue],
      [22, 60, blue],
      [42, 60, blue],
    ],
    5: [
      [22, 30, blue],
      [42, 30, blue],
      [32, 46, red],
      [22, 62, blue],
      [42, 62, blue],
    ],
    6: [
      [24, 28, blue],
      [40, 28, blue],
      [24, 46, blue],
      [40, 46, blue],
      [24, 64, blue],
      [40, 64, blue],
    ],
    7: [
      [22, 28, green],
      [42, 28, green],
      [22, 46, green],
      [32, 46, red],
      [42, 46, green],
      [22, 64, green],
      [42, 64, green],
    ],
    8: [
      [24, 26, blue],
      [40, 26, blue],
      [24, 40, blue],
      [40, 40, blue],
      [24, 54, blue],
      [40, 54, blue],
      [24, 68, blue],
      [40, 68, blue],
    ],
    9: [
      [20, 28, blue],
      [32, 28, blue],
      [44, 28, blue],
      [20, 46, blue],
      [32, 46, red],
      [44, 46, blue],
      [20, 64, blue],
      [32, 64, blue],
      [44, 64, blue],
    ],
  };

  return (
    <g>
      {(layouts[rank] ?? []).map(([cx, cy, pipTone], i) => (
        <Pip key={i} cx={cx} cy={cy} r={pipTone === 'red' ? r + 0.4 : r} tone={pipTone} />
      ))}
    </g>
  );
}

function Bamboo({ tile }: { tile: Tile }) {
  const rank = rankOf(tile);
  if (rank === 1) {
    return (
      <g>
        <ellipse className="art-blue" cx="28" cy="52" rx="13" ry="10" />
        <ellipse className="art-blue" cx="40" cy="40" rx="7" ry="6" />
        <path className="art-red" d="M46 37 L60 33 L49 45 Z" />
        <circle fill="var(--tile-face)" cx="42" cy="38" r="1.3" />
        <path className="art-green" d="M18 46 C10 34 14 58 22 54 Z" />
        <path className="art-gold" d="M22 58 C14 72 30 74 32 60 Z" />
      </g>
    );
  }

  const sticks: Array<{ x: number; y: number; red?: boolean }> =
    rank === 2
      ? [
          { x: 24, y: 46 },
          { x: 40, y: 46 },
        ]
      : rank === 3
        ? [
            { x: 20, y: 46 },
            { x: 32, y: 46 },
            { x: 44, y: 46 },
          ]
        : rank === 4
          ? [
              { x: 24, y: 32 },
              { x: 40, y: 32 },
              { x: 24, y: 60 },
              { x: 40, y: 60 },
            ]
          : rank === 5
            ? [
                { x: 22, y: 30 },
                { x: 42, y: 30 },
                { x: 32, y: 48, red: true },
                { x: 22, y: 64 },
                { x: 42, y: 64 },
              ]
            : rank === 6
              ? [
                  { x: 24, y: 28 },
                  { x: 40, y: 28 },
                  { x: 24, y: 46 },
                  { x: 40, y: 46 },
                  { x: 24, y: 64 },
                  { x: 40, y: 64 },
                ]
              : rank === 7
                ? [
                    { x: 22, y: 28 },
                    { x: 42, y: 28 },
                    { x: 22, y: 46 },
                    { x: 32, y: 46, red: true },
                    { x: 42, y: 46 },
                    { x: 22, y: 64 },
                    { x: 42, y: 64 },
                  ]
                : rank === 8
                  ? [26, 40, 54, 68].flatMap((y) => [
                      { x: 24, y },
                      { x: 40, y },
                    ])
                  : [28, 46, 64].flatMap((y) => [
                      { x: 20, y },
                      { x: 32, y, red: y === 46 },
                      { x: 44, y },
                    ]);

  return (
    <g>
      {sticks.map((s, i) => (
        <Stick key={i} x={s.x} y={s.y} red={s.red} />
      ))}
    </g>
  );
}

function Characters({ tile }: { tile: Tile }) {
  const rank = rankOf(tile);
  const red = rank === 1 || rank === 9;
  return (
    <g className={red ? 'art-red' : 'art-ink'}>
      <text className="art-num" x="32" y="46" textAnchor="middle">
        {NUMERAL[rank - 1]}
      </text>
      <text className="art-suit" x="32" y="68" textAnchor="middle">
        萬
      </text>
    </g>
  );
}

function Honor({ char, tone }: { char: string; tone: string }) {
  return (
    <text className={`art-honor ${tone}`} x="32" y="62" textAnchor="middle">
      {char}
    </text>
  );
}

function Flower({ char, tone }: { char: string; tone: string }) {
  return (
    <g>
      <circle className={tone} cx="32" cy="30" r="8" />
      <circle fill="var(--tile-face)" cx="29.5" cy="27.5" r="2" />
      <text className={`art-honor ${tone === 'art-gold' ? 'art-gold' : 'art-ink'}`} x="32" y="72" textAnchor="middle">
        {char}
      </text>
    </g>
  );
}

/** Drawn tile face. Same picture in Safari and Chrome, at every size. */
export function TileArt({ tile }: { tile: Tile }) {
  const suit = suitOf(tile);

  let body = null;
  if (suit === 'man') body = <Characters tile={tile} />;
  else if (suit === 'pin') body = <Dots tile={tile} />;
  else if (suit === 'sou') body = <Bamboo tile={tile} />;
  else if (suit === 'wind') body = <Honor char={WIND[tile - 27] ?? '東'} tone="art-ink" />;
  else if (tile === 31) body = <Honor char="中" tone="art-red" />;
  else if (tile === 32) body = <Honor char="發" tone="art-green" />;
  else if (suit === 'dragon') {
    body = (
      <rect
        x="16"
        y="20"
        width="32"
        height="52"
        rx="4"
        fill="none"
        stroke="var(--tile-blue)"
        strokeWidth="5"
      />
    );
  } else if (suit === 'season') {
    const tones = ['art-red', 'art-green', 'art-gold', 'art-blue'];
    body = <Flower char={SEASON[tile - 34] ?? '春'} tone={tones[tile - 34] ?? 'art-red'} />;
  } else {
    const tones = ['art-red', 'art-green', 'art-gold', 'art-green'];
    body = <Flower char={PLANT[tile - 38] ?? '梅'} tone={tones[tile - 38] ?? 'art-red'} />;
  }

  return (
    <svg className="tile-art" viewBox="0 0 64 88" aria-hidden="true">
      {body}
    </svg>
  );
}
