import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cls } from './cls.js';

/**
 * A dialog. `sheet` docks to the bottom of a phone; on a wide screen it
 * stays centered like the other dialogs.
 */
export function Modal({
  title,
  children,
  narrow = false,
  sheet = false,
  className,
}: {
  title?: string;
  children: ReactNode;
  narrow?: boolean;
  sheet?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    const focusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return (
    <div
      className={cls('modal-backdrop', sheet && 'modal-backdrop-sheet')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        ref={ref}
        className={cls('modal', 'ui-modal', narrow && 'modal-narrow', sheet && 'modal-sheet', className)}
      >
        {title && <h2 id={titleId}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
