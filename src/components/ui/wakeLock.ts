import { useEffect } from "react";

/**
 * Keeps the screen on while `on`: a phone that dims and locks halfway through a take stops
 * you watching the band (and may take the audio away with it). The browser drops the lock
 * when the page is hidden, so it's taken again when the page comes back.
 */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const take = () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (done) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {
          /* refused (battery saver, no permission): the screen just sleeps as usual */
        });
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}
