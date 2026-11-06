import type { ReactNode } from 'react';
import { WIND_CHINESE, WIND_NAMES } from '@mahjong/shared';
import { Badge } from './Badge.js';
import { Button } from './Button.js';
import { cls } from './cls.js';

export type SeatPos = 'south' | 'east' | 'north' | 'west';

const SEAT_TOKEN = ['east', 'south', 'west', 'north'] as const;

/**
 * One player at the table: wind, name, score, and the flags that matter
 * mid-hand. The wind color is a ring, not the text.
 */
export function SeatPanel({
  pos,
  name,
  wind,
  score = 0,
  showScore = true,
  self = false,
  dealer = false,
  bot = false,
  away = false,
  passedWater = false,
  thinking = false,
  current = false,
  waiting = false,
  onReplace,
  className,
  children,
}: {
  pos: SeatPos;
  name: string;
  wind: number;
  score?: number;
  showScore?: boolean;
  self?: boolean;
  dealer?: boolean;
  bot?: boolean;
  away?: boolean;
  passedWater?: boolean;
  thinking?: boolean;
  current?: boolean;
  waiting?: boolean;
  onReplace?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const windKey = SEAT_TOKEN[wind] ?? 'east';
  const windChar = WIND_CHINESE[wind] ?? WIND_CHINESE[0];

  return (
    <div
      className={cls(
        'seat',
        'ui-seat',
        `seat-${pos}`,
        self && 'seat-self',
        current && 'seat-current',
        waiting && 'seat-waiting',
        away && 'seat-away',
        className,
      )}
      style={{ ['--seat-color' as string]: `var(--seat-${windKey})` }}
    >
      <span
        className={cls('seat-avatar', dealer && 'seat-avatar-dealer')}
        aria-hidden="true"
      >
        {away ? '—' : windChar}
      </span>
      <div className="seat-body">
        <div className="seat-header">
          <span className="seat-wind-badge">
            {windChar} {WIND_NAMES[wind]}
          </span>
          <span className="seat-name">
            {name}
            {self && ' (you)'}
          </span>
          {dealer && (
            <Badge tone="danger" title="Dealer">
              莊
            </Badge>
          )}
          {bot && <Badge>bot</Badge>}
          {away && (
            <Badge tone="warning" title="Disconnected. They can rejoin with the table code.">
              away
            </Badge>
          )}
          {passedWater && (
            <Badge tone="warning" title="Passed on a win. Cannot win until they draw and throw.">
              過水
            </Badge>
          )}
          {thinking && <Badge tone="accent">thinking…</Badge>}
        </div>
        {showScore && (
          <div className="seat-chips">
            <span className="seat-coin" aria-hidden="true" />
            <span className="seat-score">{score}</span>
          </div>
        )}
        {onReplace && (
          <Button variant="secondary" size="sm" className="replace-bot" onClick={onReplace}>
            Replace with bot
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
