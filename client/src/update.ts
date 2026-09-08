const BUILD_KEY = 'mahjong.build';
const RELOAD_PARAM = '_reload';

export function pageBuildId(): string | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('meta[name="build-id"]')?.getAttribute('content') ?? null;
}

export function updateIsAvailable(local: string | null, remote: string | null): boolean {
  return Boolean(local && remote && local !== remote);
}

export function rememberedBuild(): string | null {
  const fromPage = pageBuildId();
  if (fromPage) return fromPage;
  try {
    return sessionStorage.getItem(BUILD_KEY);
  } catch {
    return null;
  }
}

export function rememberBuild(id: string): void {
  if (pageBuildId()) return;
  try {
    sessionStorage.setItem(BUILD_KEY, id);
  } catch {
    // Private browsing.
  }
}

export function forgetRememberedBuild(): void {
  try {
    sessionStorage.removeItem(BUILD_KEY);
  } catch {
    // Ignore.
  }
}

/** Drop the cache-bust query after a successful Update so the URL stays shareable. */
export function cleanReloadParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RELOAD_PARAM)) return;
  forgetRememberedBuild();
  url.searchParams.delete(RELOAD_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, '', next);
}

export async function fetchBuildId(): Promise<string | null> {
  const res = await fetch(`/version?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!data || typeof data !== 'object' || !('build' in data)) return null;
  const build = (data as { build: unknown }).build;
  return typeof build === 'string' && build.length > 0 ? build : null;
}

/**
 * One tap should be enough after a Railway deploy. Safari will happily keep
 * serving a cached shell through a normal refresh; this clears what we can
 * and then loads `/?_reload=…` so the new `index.html` actually arrives.
 */
export async function applyClientUpdate(): Promise<void> {
  forgetRememberedBuild();
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Still reload even if cache APIs are blocked.
  }

  try {
    await fetch(`/?${RELOAD_PARAM}=${Date.now()}`, {
      cache: 'reload',
      credentials: 'same-origin',
    });
  } catch {
    // Navigation below is the real load.
  }

  const url = new URL(window.location.href);
  url.searchParams.set(RELOAD_PARAM, String(Date.now()));
  window.location.replace(url.href);
}
