/**
 * Lets important network work (signing in) go first: while it runs, background downloads
 * (chapter refresh, PDF/image pre-caching) pause, so a slow connection is not saturated and
 * the sign-in request does not time out with "auth/network-request-failed".
 */
let holds = 0;

/** Pause background downloads until the returned function is called. */
export function holdBackgroundWork(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
  };
}

export const isBackgroundPaused = () => holds > 0;

/** Resolves when no hold is active (checks twice a second). */
export async function waitForBackgroundTurn(): Promise<void> {
  while (holds > 0) await new Promise(r => setTimeout(r, 500));
}
