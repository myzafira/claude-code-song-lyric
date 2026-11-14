/**
 * Auto-start for the embedded YouTube player.
 *
 * Browsers often block autoplay with sound, so a song can sit on YouTube's
 * big play button. If the clip still isn't playing AUTOSTART_DELAY_MS after it
 * loads, we press play for the singer. If the browser still refuses (sound
 * blocked), we start it muted — browsers always allow that — and the app
 * shows a "tap to turn sound on" button.
 */

export const AUTOSTART_DELAY_MS = 5000;
/** How long to wait after pressing play before deciding the browser blocked it. */
export const AUTOSTART_RETRY_MS = 1500;

/** YouTube IFrame API player states. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/**
 * Whether the clip has started (or is starting) on its own, so we should leave
 * it alone. Paused counts as started: the singer may have paused on purpose.
 */
export function hasStarted(state: number | undefined): boolean {
  return (
    state === YT_STATE.PLAYING ||
    state === YT_STATE.BUFFERING ||
    state === YT_STATE.PAUSED ||
    state === YT_STATE.ENDED
  );
}

export type AutostartStep = "none" | "play" | "play-muted";

/**
 * What to do at each check: at the first check (attempt 0) press play; at the
 * second (attempt 1) fall back to muted play; after that, give up.
 */
export function nextAutostartStep(state: number | undefined, attempt: number): AutostartStep {
  if (hasStarted(state)) return "none";
  if (attempt === 0) return "play";
  if (attempt === 1) return "play-muted";
  return "none";
}
