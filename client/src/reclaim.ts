/** True whenever a live socket plus a stored seat should call joinRoom. */
export function shouldReclaimSeat(
  connected: boolean,
  session: { roomCode: string; token: string; name: string } | null,
): boolean {
  return Boolean(connected && session);
}

/** Keep the table up and show a banner instead of bouncing to "Connecting…". */
export function shouldShowReconnectBanner(
  connected: boolean,
  rejoining: boolean,
  hasView: boolean,
): boolean {
  return hasView && (!connected || rejoining);
}
