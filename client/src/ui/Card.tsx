import type { ReactNode } from 'react';
import { cls } from './cls.js';

export function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cls('ui-card', className)}>
      {title && <h3 className="ui-card-title">{title}</h3>}
      {children}
    </section>
  );
}
