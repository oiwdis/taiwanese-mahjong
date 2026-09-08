import { useEffect, useState } from 'react';
import {
  applyClientUpdate,
  cleanReloadParam,
  fetchBuildId,
  rememberBuild,
  rememberedBuild,
  updateIsAvailable,
} from './update.js';

const POLL_MS = 15_000;

export function useServerUpdate() {
  const [available, setAvailable] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    cleanReloadParam();
    let cancelled = false;

    const check = async () => {
      try {
        const remote = await fetchBuildId();
        if (cancelled || !remote) return;
        const local = rememberedBuild();
        if (!local) {
          rememberBuild(remote);
          return;
        }
        if (updateIsAvailable(local, remote)) setAvailable(true);
      } catch {
        // Offline or mid-deploy; the connecting screen still has Update.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const apply = () => {
    if (applying) return;
    setApplying(true);
    void applyClientUpdate();
  };

  return { available, applying, apply };
}
