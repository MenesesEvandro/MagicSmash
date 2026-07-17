const CACHE_PREFIX = "magic-smash-";
// The version placeholder below is filled in at build time (scripts/build.mjs)
// with a content hash of everything in CORE_ASSETS, so any real change to the
// app produces a new cache name automatically.
const CACHE_NAME = `${CACHE_PREFIX}24f84c3340`;
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
			// Only ever remove this app's own old versions. A bare "delete
			// anything not CACHE_NAME" would also wipe out any unrelated cache
			// this origin happens to have, which isn't ours to touch.
			caches
				.keys()
				.then((keys) =>
					Promise.all(
						keys
							.filter(
								(key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
							)
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

// Cache-first, and always scoped to this worker's own versioned cache via
// caches.open(CACHE_NAME) — never a bare caches.match(), which would search
// every cache this origin has, old and new alike. Named caches still live in
// the one shared, per-origin CacheStorage; the isolation comes from each
// worker version only ever reading its own same-named cache within it, which
// is what keeps a version pinned for a whole session: an older, still-active
// worker can never end up serving files a newer, still-waiting worker
// already cached, or vice versa.
//
// Anything not already cached is fetched from the network. Only successful,
// same-origin responses get cached — a 404 would otherwise poison the cache
// forever (cache-first never re-validates), and cross-origin/opaque
// responses are skipped rather than risk a rejected put(). The cache write
// is kept alive with waitUntil (the worker can be killed the instant
// respondWith's promise settles) and its own failure is swallowed, since
// caching is a nice-to-have, not something a response should ever hinge on.
// Offline navigations with nothing cached fall back to the app shell;
// offline requests for anything else (a script, an image) fail normally
// instead of getting HTML back where a different resource was expected.
self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	event.respondWith(
		caches
			.open(CACHE_NAME)
			.then(async (cache) => {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				try {
					const response = await fetch(event.request);
					if (response.ok && response.type === "basic") {
						event.waitUntil(
							cache.put(event.request, response.clone()).catch(() => {
								/* A failed cache write shouldn't surface as an unhandled rejection. */
							}),
						);
					}
					return response;
				} catch (error) {
					if (event.request.mode === "navigate") {
						const shell = await cache.match("./index.html");
						if (shell) return shell;
					}
					throw error;
				}
			})
			.catch(() => fetch(event.request)),
	);
});
