const CACHE_NAME = "magic-smash-v1";
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
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

// A page can ask a waiting worker to take over immediately. This only ever
// runs after the parent explicitly taps "Update now" in Settings.
self.addEventListener("message", (event) => {
	if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Cache-first: once installed, always serve the version that was cached at
// install time, so the app never changes under a child's fingers on its own.
// Anything not already cached is fetched from the network and cached for
// next time; offline requests for uncached pages fall back to the app shell.
self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request)
				.then((response) => {
					const copy = response.clone();
					caches
						.open(CACHE_NAME)
						.then((cache) => cache.put(event.request, copy));
					return response;
				})
				.catch(() => caches.match("./index.html"));
		}),
	);
});
