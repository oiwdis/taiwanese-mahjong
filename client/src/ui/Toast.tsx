import type { ReactNode } from 'react';
import { cls } from './cls.js';

export function Toast({
  children,
  tone = 'danger',
}: {
  children: ReactNode;
  tone?: 'danger' | 'info';
}) {
  return (
    <p className={cls('ui-toast', `ui-toast-${tone}`, tone === 'danger' && 'error')} role="alert">
      {children}
    </p>
  );
}
