// Minimal static file server for the E2E tests (and handy for manual
// testing): serves the repository root over http://localhost so service
// workers and the manifest behave like production. No dependencies, same as
// build.mjs — run with `node scripts/serve.mjs [port]`.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2]) || 4173;
const root = fileURLToPath(new URL("..", import.meta.url));

const mimeTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

createServer(async (request, response) => {
	const urlPath = decodeURIComponent(new URL(request.url, "http://x").pathname);
	const relative = urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath;
	const filePath = normalize(join(root, relative));
	// normalize() collapses any ../ segments; anything that escaped the root
	// after that is a traversal attempt, not a file we serve.
	if (!filePath.startsWith(normalize(root + sep))) {
		response.writeHead(403).end();
		return;
	}
	try {
		const body = await readFile(filePath);
		response.writeHead(200, {
			"content-type":
				mimeTypes[extname(filePath)] || "application/octet-stream",
		});
		response.end(body);
	} catch {
		response.writeHead(404).end("Not found");
	}
}).listen(port, () => {
	console.log(`Serving ${root} at http://localhost:${port}`);
});
