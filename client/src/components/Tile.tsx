import type React from 'react';
import { cornerLabelOf, englishNameOf, glyphOf, chineseNameOf, suitOf, type Tile } from '@mahjong/shared';

export type TileSize = 'xs' | 'sm' | 'md' | 'lg';

export interface TileProps {
  tile: Tile;
  size?: TileSize;
  onClick?: () => void;
  disabled?: boolean;
  /** Draws a ring, used for the freshly drawn tile and for waits. */
  highlight?: boolean;
  /** Dims the tile, used for tiles that cannot be discarded. */
  dim?: boolean;
  /** Small badge in the lower corner, e.g. how many copies are unseen. */
  badge?: string | number;
  title?: string;
  /** Extra classes, for table placement and animations. */
  className?: string;
  /** The tile can be dragged to rearrange a hand. */
  sortable?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLButtonElement>;
  'data-hand-index'?: number;
}

/**
 * A tile face.
 *
 * The centre is the Unicode Mahjong Tiles glyph. The top-right corner carries
 * a Latin label so the tile is readable without knowing the suits: "1m" for
 * 一萬, "5p", "9s", and E/S/W/N for the winds. Dragons use R (紅中), G (青發)
 * and Wh (白板) — "Wh" rather than "W" so it cannot be confused with West.
 */
export function TileFace({
  tile,
  size = 'md',
  onClick,
  disabled,
  highlight,
  dim,
  badge,
  title,
  className,
  sortable,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  'data-hand-index': handIndex,
}: TileProps) {
  const label = cornerLabelOf(tile);
  const suited = /^(\d)([mps])$/.exec(label);
  const enabled = !disabled && (Boolean(onClick) || Boolean(sortable));
  const interactive = Boolean(onClick) && enabled;

  const classes = [
    'tile',
    `tile-${size}`,
    `tile-suit-${suitOf(tile)}`,
    highlight ? 'tile-highlight' : '',
    dim ? 'tile-dim' : '',
    interactive ? 'tile-interactive' : '',
    sortable ? 'tile-sortable' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={interactive ? onClick : undefined}
      disabled={!enabled}
      draggable={false}
      data-hand-index={handIndex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      title={title ?? `${englishNameOf(tile)} · ${chineseNameOf(tile)}`}
      aria-label={englishNameOf(tile)}
    >
      <span className="tile-corner">
        {suited ? (
          <>
            <span className="tile-rank">{suited[1]}</span>
            <span className="tile-suit">{suited[2]}</span>
          </>
        ) : (
          <span className="tile-rank">{label}</span>
        )}
      </span>
      <span className="tile-glyph">{glyphOf(tile)}</span>
      {badge !== undefined && <span className="tile-badge">{badge}</span>}
    </button>
  );
}

/** A face-down tile, for other players' concealed hands. */
export function TileBack({
  size = 'sm',
  className,
}: {
  size?: TileSize;
  className?: string;
}) {
  return (
    <span
      className={['tile', `tile-${size}`, 'tile-back', className ?? ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}

export function TileRow({
  tiles,
  size = 'sm',
  onTileClick,
}: {
  tiles: Tile[];
  size?: TileSize;
  onTileClick?: (tile: Tile, index: number) => void;
}) {
  return (
    <div className="tile-row">
      {tiles.map((t, i) => (
        <TileFace
          key={`${t}-${i}`}
          tile={t}
          size={size}
          onClick={onTileClick ? () => onTileClick(t, i) : undefined}
        />
      ))}
    </div>
  );
}
