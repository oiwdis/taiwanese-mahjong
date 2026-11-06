import { useState, type ReactNode } from 'react';
import { Button } from './Button.js';

function dismissed(id: string): boolean {
  try {
    return globalThis.localStorage?.getItem(`mahjong.hint.${id}`) === 'off';
  } catch {
    return false;
  }
}

/** A short first-run note. Dismissing it sticks on this device. */
export function Hint({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => !dismissed(id));
  if (!open) return null;

  return (
    <div className="ui-hint" role="note">
      <div className="ui-hint-copy">
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          try {
            globalThis.localStorage?.setItem(`mahjong.hint.${id}`, 'off');
          } catch {
            // Private browsing.
          }
          setOpen(false);
        }}
      >
        Got it
      </Button>
    </div>
  );
}
