const CACHE_NAME = "magic-smash-__CACHE_VERSION__";
const CORE_ASSETS = [
	"./",
	"./index.html",
	"./styles.css",
	"./app.js",
	"./manifest.webmanifest",
	"./icons/icon-192.png",
	"./icons/icon-512.png",
];

// No self.skipWaiting() here on purpose. A parent installs this once for
// their kid and the app should keep behaving exactly the same way until
// *they* choose to update it — never silently, mid-session, without asking.
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) =>
				cache.addAll(
					CORE_ASSETS.map((url) => new Request(url, { cache: "reload" })),
				),
			),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.keys()
				.then((keys) =>
					Promise.all(
						keys
							.filter((key) => key !== CACHE_NAME)
							.map((key) => caches.delete(key)),
					),
				),
			self.clients.claim(),
		]),
	);
});

// A page can ask a waiting worker to take over immediately. This only ever
// runs after the parent explicitly taps "Update now" in Settings.
self.addEventListener("message", (event) => {
	if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Cache-first, and always scoped to this worker's own versioned cache (never
// the shared, global CacheStorage) — so an older, still-active worker can
// never end up serving files a newer, still-waiting worker already cached,
// or vice versa. That's what keeps a version pinned for a whole session.
//
// Anything not already cached is fetched from the network and cached for
// next time (kept alive with waitUntil, since the service worker can be
// killed the instant respondWith's promise settles). Offline navigations
// with nothing cached fall back to the app shell; offline requests for
// anything else (a script, an image) fail normally instead of getting HTML
// back where a different resource was expected.
self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	event.respondWith(
		caches.open(CACHE_NAME).then(async (cache) => {
			const cached = await cache.match(event.request);
			if (cached) return cached;
			try {
				const response = await fetch(event.request);
				event.waitUntil(cache.put(event.request, response.clone()));
				return response;
			} catch (error) {
				if (event.request.mode === "navigate") {
					const shell = await cache.match("./index.html");
					if (shell) return shell;
				}
				throw error;
			}
		}),
	);
});
