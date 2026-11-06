import type { AvailableAction } from '@mahjong/shared';
import { TileGlyph } from '../components/Tile.js';
import { Button, type ButtonVariant } from './Button.js';
import { cls } from './cls.js';

const TYPE_ORDER: Record<string, number> = {
  win: 0,
  flowerWin: 1,
  kong: 2,
  concealedKong: 3,
  addedKong: 4,
  pung: 5,
  chow: 6,
  pass: 9,
};

function variantOf(action: AvailableAction): ButtonVariant {
  if (action.type === 'win' || action.type === 'flowerWin') return 'danger';
  if (action.type === 'pass') return 'secondary';
  return 'secondary';
}

function extraClass(action: AvailableAction): string {
  if (action.type === 'win' || action.type === 'flowerWin') return 'btn-win';
  if (action.type === 'pass') return action.armsPassedWater ? 'btn-pass-warn' : 'btn-pass';
  return 'btn-call';
}

function previewTiles(action: AvailableAction): { tile: number; claimed: boolean }[] | null {
  if (action.type === 'chow' && action.chowLow !== undefined) {
    const low = action.chowLow;
    return [0, 1, 2].map((i) => ({ tile: low + i, claimed: low + i === action.tile }));
  }
  if ((action.type === 'pung' || action.type === 'kong') && action.tile !== undefined) {
    const count = action.type === 'kong' ? 4 : 3;
    return Array.from({ length: count }, (_, i) => ({
      tile: action.tile as number,
      claimed: i === count - 1,
    }));
  }
  return null;
}

/** Chi, pong, gang, win, and pass. Each server choice is its own button. */
export function ActionButtons({
  actions,
  onAct,
  className,
  showTiles = false,
}: {
  actions: readonly AvailableAction[];
  onAct: (action: AvailableAction) => void;
  className?: string;
  showTiles?: boolean;
}) {
  const ordered = [...actions].sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 8) - (TYPE_ORDER[b.type] ?? 8),
  );

  return (
    <div className={cls('action-buttons', className)}>
      {ordered.map((action) => {
        const tiles = showTiles ? previewTiles(action) : null;
        return (
          <Button
            key={action.id}
            variant={variantOf(action)}
            className={extraClass(action)}
            onClick={() => onAct(action)}
          >
            {tiles && (
              <span className="action-tiles" aria-hidden="true">
                {tiles.map((t, i) => (
                  <TileGlyph
                    key={`${t.tile}-${i}`}
                    tile={t.tile}
                    size="discard"
                    highlight={t.claimed}
                  />
                ))}
              </span>
            )}
            <span className="action-label">{action.label}</span>
            {action.taiPreview !== undefined && action.type !== 'pass' && (
              <span className="action-tai">{action.taiPreview} tai</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
