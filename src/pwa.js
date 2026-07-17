/**
 * Hands the caller a function that tells `worker` to stop waiting and
 * activate; does nothing when no callback was provided.
 * @param {ServiceWorker} worker Installed worker waiting to activate.
 * @param {(applyUpdate: () => void) => void} [onUpdateReady]
 */
function notifyUpdate(worker, onUpdateReady) {
	if (typeof onUpdateReady !== "function") return;
	onUpdateReady(() => worker.postMessage("SKIP_WAITING"));
}

/** localStorage key remembering that the iOS install tip was dismissed. */
const IOS_TIP_DISMISSED_KEY = "magic-smash-ios-tip-dismissed";

/** @returns {boolean} Whether this is an iOS or iPadOS device. */
function isIosDevice() {
	const ua = navigator.userAgent;
	if (/iPad|iPhone|iPod/.test(ua)) return true;
	// iPadOS 13+ identifies as "MacIntel" by default; touch support is the tell.
	return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** @returns {boolean} Whether the app runs installed (standalone display mode). */
function isRunningStandalone() {
	return (
		window.navigator.standalone === true ||
		window.matchMedia("(display-mode: standalone)").matches
	);
}

/**
 * @returns {boolean} Whether to show the iOS install tip: only on an iOS
 * device, not under file://, not already installed, and not previously
 * dismissed.
 */
export function shouldShowIosInstallTip() {
	if (window.location.protocol === "file:") return false;
	if (!isIosDevice() || isRunningStandalone()) return false;
	try {
		return localStorage.getItem(IOS_TIP_DISMISSED_KEY) !== "true";
	} catch {
		// Some browsers (e.g. Safari private mode, storage fully disabled) can
		// throw on any localStorage access. This runs during startup, so a
		// thrown error here must not stop the rest of the app from booting.
		return false;
	}
}

/** Remembers that the user dismissed the iOS install tip. */
export function dismissIosInstallTip() {
	try {
		localStorage.setItem(IOS_TIP_DISMISSED_KEY, "true");
	} catch {
		/* Dismissing is best-effort; a full storage quota shouldn't block it. */
	}
}

/**
 * Injects the manifest `<link>` at runtime. Chrome fetches a
 * `<link rel="manifest">` as soon as it's parsed, before any JS runs — and
 * that fetch is blocked under file:// the same way ES module imports were.
 * A static `<link>` in the HTML has no way to opt out, so the manifest is
 * linked here instead, only when it can actually be fetched.
 */
export function linkManifest() {
	if (window.location.protocol === "file:") return;
	const link = document.createElement("link");
	link.rel = "manifest";
	link.href = "manifest.webmanifest";
	document.head.appendChild(link);
}

/**
 * Registers ./sw.js once the page loads; no-op without service worker
 * support or under file://. Reloads the page (once) when a new worker takes
 * control. Both an already-waiting worker and one installed later surface
 * through `onUpdateReady`.
 * @param {(applyUpdate: () => void) => void} [onUpdateReady] Called when an
 * updated worker is ready; receives a function that activates it.
 */
export function registerServiceWorker(onUpdateReady) {
	if (!("serviceWorker" in navigator) || window.location.protocol === "file:")
		return;

	let reloading = false;
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (reloading) return;
		reloading = true;
		window.location.reload();
	});

	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("./sw.js")
			.then((registration) => {
				if (registration.waiting)
					notifyUpdate(registration.waiting, onUpdateReady);
				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					if (!newWorker) return;
					newWorker.addEventListener("statechange", () => {
						const isUpdate =
							newWorker.state === "installed" &&
							navigator.serviceWorker.controller;
						if (isUpdate) notifyUpdate(newWorker, onUpdateReady);
					});
				});
			})
			.catch(() => {
				/* Installing as an app is optional; ignore registration failures. */
			});
	});
}
