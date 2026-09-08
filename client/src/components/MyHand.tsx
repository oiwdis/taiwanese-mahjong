import type React from 'react';
import { useRef, useState } from 'react';
import { sortTiles, type Tile } from '@mahjong/shared';
import { dealKeyOf, moveTile, reconcileHand, sameMultiset } from '../handOrder.js';
import { TileFace } from './Tile.js';

const DRAG_THRESHOLD_PX = 8;

type Placed = { id: number; tile: Tile };

function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

function placeTiles(tiles: readonly Tile[], nextId: { current: number }): Placed[] {
  return tiles.map((tile) => ({ id: nextId.current++, tile }));
}

/** Keep stable ids for tiles that stayed so pointer capture survives a reorder. */
function adoptOrder(
  previous: readonly Placed[],
  incomingOrder: readonly Tile[],
  nextId: { current: number },
): Placed[] {
  const unused = [...previous];
  return incomingOrder.map((tile) => {
    const i = unused.findIndex((p) => p.tile === tile);
    if (i >= 0) {
      const [placed] = unused.splice(i, 1);
      return placed!;
    }
    return { id: nextId.current++, tile };
  });
}

function useOrderedHand(
  serverHand: readonly Tile[],
  dealKey: string,
): [Placed[], (next: Placed[]) => void] {
  const nextId = useRef(1);
  const [state, setState] = useState(() => ({
    dealKey,
    tiles: placeTiles(sortTiles(serverHand), nextId),
  }));

  let tiles = state.tiles;
  if (dealKey !== state.dealKey) {
    tiles = placeTiles(sortTiles(serverHand), nextId);
    setState({ dealKey, tiles });
  } else if (!sameMultiset(state.tiles.map((p) => p.tile), serverHand)) {
    tiles = adoptOrder(state.tiles, reconcileHand(state.tiles.map((p) => p.tile), serverHand), nextId);
    setState({ dealKey, tiles });
  }

  return [tiles, (next) => setState((s) => ({ ...s, tiles: next }))];
}

function indexAtPoint(root: HTMLElement, clientX: number, clientY: number): number {
  const slots = root.querySelectorAll<HTMLElement>('[data-hand-index]');
  let best = -1;
  let bestDist = Infinity;
  for (const slot of slots) {
    const rect = slot.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = Number(slot.dataset.handIndex);
    }
  }
  return best;
}

export function MyHand({
  view,
  canDiscard,
  discardable,
  onDiscard,
}: {
  view: {
    roomCode: string;
    you: number | null;
    roundWind: number;
    roundNumber: number;
    handNumber: number;
    hand: Tile[];
    drawnTile: Tile | null;
  };
  canDiscard: boolean;
  discardable: readonly Tile[];
  onDiscard: (tile: Tile) => void;
}) {
  const dealKey = dealKeyOf(view);
  const [tiles, setTiles] = useOrderedHand(view.hand, dealKey);
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    tile: Tile;
    current: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const onPointerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      tile: tiles[index]!.tile,
      current: index,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    skipClickRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.dragging && dist < DRAG_THRESHOLD_PX) return;
    drag.dragging = true;
    skipClickRef.current = true;
    const over = rootRef.current ? indexAtPoint(rootRef.current, event.clientX, event.clientY) : -1;
    if (over >= 0 && over !== drag.current) {
      const next = moveTile(tilesRef.current, drag.current, over);
      tilesRef.current = next;
      drag.current = over;
      setTiles(next);
      setDraggingIndex(over);
    } else if (draggingIndex !== drag.current) {
      setDraggingIndex(drag.current);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDraggingIndex(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onTileClick = (tile: Tile) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    if (canDiscard) onDiscard(tile);
  };

  const tileValues = tiles.map((p) => p.tile);

  return (
    <div
      ref={rootRef}
      className={cls('my-hand', draggingIndex !== null && 'my-hand-sorting')}
    >
      {tiles.map((placed, i) => (
        <TileFace
          key={placed.id}
          tile={placed.tile}
          size="lg"
          sortable
          data-hand-index={i}
          highlight={view.drawnTile === placed.tile && i === tileValues.lastIndexOf(placed.tile)}
          dim={canDiscard && !discardable.includes(placed.tile)}
          className={cls(i === draggingIndex && 'tile-dragging')}
          onPointerDown={(event) => onPointerDown(i, event)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={canDiscard ? () => onTileClick(placed.tile) : undefined}
        />
      ))}
    </div>
  );
}
