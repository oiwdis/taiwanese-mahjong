import type { HTMLAttributes } from 'react';
import { cls } from './cls.js';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'success' | 'warning';

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = 'neutral', className, ...rest }: Props) {
  return <span className={cls('tag', 'ui-badge', `ui-badge-${tone}`, className)} {...rest} />;
}
