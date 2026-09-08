import { describe, expect, it } from 'vitest';
import { shouldReclaimSeat, shouldShowReconnectBanner } from '../reclaim.js';

const session = { roomCode: 'ABCD', token: 'seat-token', name: 'Ada' };

describe('shouldReclaimSeat', () => {
  it('reclaims whenever the socket is live and a seat is stored', () => {
    // The old client skipped this once `view` was set, which is exactly the
    // state left behind by a dropped connection — that is why a refresh fixed it.
    expect(shouldReclaimSeat(true, session)).toBe(true);
  });

  it('does nothing before the socket is up or when nobody is seated', () => {
    expect(shouldReclaimSeat(false, session)).toBe(false);
    expect(shouldReclaimSeat(true, null)).toBe(false);
  });
});

describe('shouldShowReconnectBanner', () => {
  it('keeps the table mounted and banners a blip or a reclaim', () => {
    expect(shouldShowReconnectBanner(false, false, true)).toBe(true);
    expect(shouldShowReconnectBanner(true, true, true)).toBe(true);
  });

  it('stays quiet on a healthy table and on the landing page', () => {
    expect(shouldShowReconnectBanner(true, false, true)).toBe(false);
    expect(shouldShowReconnectBanner(false, false, false)).toBe(false);
  });
});
