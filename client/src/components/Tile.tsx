import type React from 'react';
import {
  cornerLabelOf,
  englishNameOf,
  chineseNameOf,
  suitOf,
  type Tile,
} from '@mahjong/shared';
import { TileArt } from './TileArt.js';

export type TileSize = 'hand' | 'discard' | 'meld' | 'back' | 'xs' | 'sm' | 'md' | 'lg';

export interface TileProps {
  tile: Tile;
  size?: TileSize;
  onClick?: () => void;
  disabled?: boolean;
  /** Gold ring. Used for the fresh discard and the winning tile. */
  highlight?: boolean;
  /** The tile you just drew. */
  justDrawn?: boolean;
  /** A discard the table is still holding for a call. */
  claimable?: boolean;
  /** Lifted, for example while dragging. */
  selected?: boolean;
  /** Dims a tile you are not allowed to throw. */
  dim?: boolean;
  /** Small badge in the lower corner, e.g. how many copies are unseen. */
  badge?: string | number;
  title?: string;
  /** Extra classes, for table placement and animations. */
  className?: string;
  /** The tile can be dragged to rearrange a hand. */
  sortable?: boolean;
  /** Decorative only: a span, not a button, hidden from assistive tech. */
  decorative?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLButtonElement>;
  'data-hand-index'?: number;
}

function sizeClass(size: TileSize): string {
  switch (size) {
    case 'hand':
    case 'lg':
      return 'tile-hand';
    case 'discard':
    case 'xs':
      return 'tile-discard';
    case 'md':
      return 'tile-md';
    case 'back':
      return 'tile-back';
    case 'meld':
    case 'sm':
    default:
      return 'tile-meld';
  }
}

function tileClasses(
  size: TileSize,
  suit: string | null,
  flags: {
    highlight?: boolean;
    justDrawn?: boolean;
    claimable?: boolean;
    selected?: boolean;
    dim?: boolean;
    interactive?: boolean;
    sortable?: boolean;
    className?: string;
  },
): string {
  return [
    'tile',
    sizeClass(size),
    suit ? `tile-suit-${suit}` : '',
    flags.highlight ? 'tile-highlight' : '',
    flags.justDrawn ? 'tile-just-drawn' : '',
    flags.claimable ? 'tile-claimable' : '',
    flags.selected ? 'tile-selected' : '',
    flags.dim ? 'tile-dim' : '',
    flags.interactive ? 'tile-interactive' : '',
    flags.sortable ? 'tile-sortable' : '',
    flags.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

function Corner({ tile }: { tile: Tile }) {
  const label = cornerLabelOf(tile);
  const suited = /^(\d)([mps])$/.exec(label);
  return (
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
  );
}

/** A tile picture with no button. Safe to put inside another control. */
export function TileGlyph({
  tile,
  size = 'meld',
  highlight,
  justDrawn,
  claimable,
  selected,
  dim,
  badge,
  className,
  decorative = true,
}: TileProps) {
  return (
    <span
      className={tileClasses(size, suitOf(tile), {
        highlight,
        justDrawn,
        claimable,
        selected,
        dim,
        className,
      })}
      aria-hidden={decorative ? true : undefined}
    >
      <Corner tile={tile} />
      <TileArt tile={tile} />
      {badge !== undefined && <span className="tile-badge">{badge}</span>}
    </span>
  );
}

/**
 * A tile face button.
 *
 * The picture is drawn (dots, bamboo, characters) so it looks the same on
 * every browser. The corner keeps a short Latin index, and the accessible
 * name is the English tile name.
 */
export function TileFace({
  tile,
  size = 'meld',
  onClick,
  disabled,
  highlight,
  justDrawn,
  claimable,
  selected,
  dim,
  badge,
  title,
  className,
  sortable,
  decorative,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  'data-hand-index': handIndex,
}: TileProps) {
  if (decorative) {
    return (
      <TileGlyph
        tile={tile}
        size={size}
        highlight={highlight}
        justDrawn={justDrawn}
        claimable={claimable}
        selected={selected}
        dim={dim}
        badge={badge}
        className={className}
        decorative
      />
    );
  }

  const enabled = !disabled && (Boolean(onClick) || Boolean(sortable));
  const interactive = Boolean(onClick) && enabled;
  const name = englishNameOf(tile);
  const detail = [
    name,
    chineseNameOf(tile),
    justDrawn ? 'just drawn' : '',
    claimable ? 'can be called' : '',
    dim ? 'cannot discard' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      className={tileClasses(size, suitOf(tile), {
        highlight,
        justDrawn,
        claimable,
        selected,
        dim,
        interactive,
        sortable,
        className,
      })}
      onClick={interactive ? onClick : undefined}
      disabled={!enabled}
      draggable={false}
      data-hand-index={handIndex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      title={title ?? detail}
      aria-label={name}
    >
      <Corner tile={tile} />
      <TileArt tile={tile} />
      {badge !== undefined && <span className="tile-badge">{badge}</span>}
    </button>
  );
}

/** A face-down tile, for concealed hands and the wall's cousins. */
export function TileBack({
  size = 'meld',
  className,
}: {
  size?: TileSize;
  className?: string;
}) {
  return (
    <span
      className={['tile', sizeClass(size), 'tile-back', className ?? ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}

export function TileRow({
  tiles,
  size = 'meld',
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
