/** Currently held WakeLockSentinel, when a screen lock is active. */
let sentinel = null;
/**
 * Whether a lock *should* be held right now, independently of the async
 * request in flight — so a session that ends while the request is still
 * pending doesn't strand an active lock afterwards.
 */
let wanted = false;
let watchingVisibility = false;

/**
 * Requests a screen wake lock and stores it as the active sentinel,
 * replacing any previous one. Rechecks {@link wanted} after the await so a
 * lock granted after the session already ended is released immediately
 * rather than stranded.
 */
async function acquire() {
	try {
		const lock = await navigator.wakeLock.request("screen");
		if (!wanted) {
			lock.release().catch(() => {});
			return;
		}
		sentinel?.release().catch(() => {});
		sentinel = lock;
	} catch {
		/* Dimming stays the browser's call; play continues fine without it. */
	}
}

/**
 * The browser releases the lock on its own whenever the page stops being
 * visible (switching apps, locking the device). This installs, at most
 * once, the listener that re-requests it when the page becomes visible
 * again while a lock is still wanted.
 */
function watchVisibility() {
	if (watchingVisibility) return;
	watchingVisibility = true;
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && wanted) acquire();
	});
}

/**
 * Keeps the screen awake from now on, so the tablet doesn't dim and lock on
 * a toddler who is just watching the effects without touching anything.
 * Entirely optional: no-op on browsers without the Wake Lock API, and when
 * the request is denied (battery saver, permissions policy) everything
 * silently behaves exactly as before.
 */
export function keepScreenAwake() {
	if (!("wakeLock" in navigator)) return;
	wanted = true;
	watchVisibility();
	acquire();
}

/**
 * Stops keeping the screen awake: releases the held lock and flags any
 * still-pending request to discard its result.
 */
export function releaseWakeLock() {
	wanted = false;
	sentinel?.release().catch(() => {});
	sentinel = null;
}
