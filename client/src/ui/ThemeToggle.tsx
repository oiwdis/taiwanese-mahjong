import { useState } from 'react';
import { Button } from './Button.js';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'light' || set === 'dark') return set;
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(next: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('mahjong.theme', next);
  } catch {
    // Private browsing.
  }
}

/** Switches the room between light and dark. The felt stays green. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={next === 'light' ? 'Switch to a light room' : 'Switch to a dark room'}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {next === 'light' ? 'Light room' : 'Dark room'}
    </Button>
  );
}
