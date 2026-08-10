// Regression tests for the full-screen recovery button: shown when the
// browser drops out of full screen mid-session (an accidental swipe or Esc,
// not the app's own doing), hidden again once full screen returns or the
// session ends. Drives the built app.js (the real shipped artifact —
// `npm test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Boots a fresh app instance: real index.html + built app.js in jsdom. */
function bootApp() {
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	const { window } = dom;
	if (!window.HTMLDialogElement.prototype.showModal) {
		window.HTMLDialogElement.prototype.showModal = function () {
			this.open = true;
		};
		window.HTMLDialogElement.prototype.close = function () {
			this.open = false;
		};
	}
	// jsdom doesn't implement the Fullscreen API: fullscreenElement is
	// missing entirely, and requestFullscreen isn't a function. Stub both
	// the same way idle-attract.test.mjs shadows visibilityState.
	Object.defineProperty(window.document, "fullscreenElement", {
		value: null,
		configurable: true,
		writable: true,
	});
	window.document.documentElement.requestFullscreen = () => {
		window.document.fullscreenElement = window.document.documentElement;
		window.document.dispatchEvent(new window.Event("fullscreenchange"));
		return Promise.resolve();
	};
	const script = window.document.createElement("script");
	script.textContent = appJs;
	window.document.body.appendChild(script);
	return window;
}

async function startSession(window) {
	window.document.getElementById("startButton").click();
	await sleep(50);
}

const setFullscreen = (window, element) => {
	window.document.fullscreenElement = element;
	window.document.dispatchEvent(new window.Event("fullscreenchange"));
};

const isRecoveryShown = (window) =>
	!window.document
		.getElementById("fullscreenRecoveryButton")
		.classList.contains("hidden");

test("stays hidden on the welcome screen, even if full screen drops", (t) => {
	const window = bootApp();
	t.after(() => window.close());

	setFullscreen(window, null);

	assert.equal(isRecoveryShown(window), false);
});

test("shows up when full screen drops mid-session", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	setFullscreen(window, null);

	assert.equal(isRecoveryShown(window), true);
});

test("the button re-requests full screen and hides itself again on success", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	setFullscreen(window, null);
	assert.equal(
		isRecoveryShown(window),
		true,
		"sanity check: should be showing first",
	);

	window.document.getElementById("fullscreenRecoveryButton").click();
	await sleep(10);

	assert.equal(isRecoveryShown(window), false);
});

test("ending the session hides it even if it was showing", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	setFullscreen(window, null);
	assert.equal(
		isRecoveryShown(window),
		true,
		"sanity check: should be showing first",
	);

	window.endGame();

	assert.equal(isRecoveryShown(window), false);
});
