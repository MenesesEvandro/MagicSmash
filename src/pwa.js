function notifyUpdate(worker, onUpdateReady) {
	if (typeof onUpdateReady !== "function") return;
	onUpdateReady(() => worker.postMessage("SKIP_WAITING"));
}

const IOS_TIP_DISMISSED_KEY = "magic-smash-ios-tip-dismissed";

function isIosDevice() {
	const ua = navigator.userAgent;
	if (/iPad|iPhone|iPod/.test(ua)) return true;
	// iPadOS 13+ identifies as "MacIntel" by default; touch support is the tell.
	return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isRunningStandalone() {
	return (
		window.navigator.standalone === true ||
		window.matchMedia("(display-mode: standalone)").matches
	);
}

export function shouldShowIosInstallTip() {
	if (window.location.protocol === "file:") return false;
	if (!isIosDevice() || isRunningStandalone()) return false;
	return localStorage.getItem(IOS_TIP_DISMISSED_KEY) !== "true";
}

export function dismissIosInstallTip() {
	try {
		localStorage.setItem(IOS_TIP_DISMISSED_KEY, "true");
	} catch {
		/* Dismissing is best-effort; a full storage quota shouldn't block it. */
	}
}

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
