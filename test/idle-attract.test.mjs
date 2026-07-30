// Regression tests for the idle/attract mode: after a stretch of no input
// during play, the background livens up (body.idle) on its own, and any
// input pops it back out. Drives the built app.js (the real shipped
// artifact — `npm test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Matches IDLE_TIMEOUT_MS in src/effects.js, plus a little slack. */
const IDLE_MS = 10000 + 300;

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
	const script = window.document.createElement("script");
	script.textContent = appJs;
	window.document.body.appendChild(script);
	return window;
}

async function startSession(window) {
	window.document.getElementById("startButton").click();
	await sleep(50);
	assert.equal(
		window.document.getElementById("keyStage").classList.contains("hidden"),
		false,
		"session should be running",
	);
}

const isIdle = (window) => window.document.body.classList.contains("idle");

test("the background goes idle after a stretch of no input, and any input pops it back out", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	assert.equal(isIdle(window), false, "must not start idle");
	await sleep(IDLE_MS);
	assert.equal(
		isIdle(window),
		true,
		"must go idle after the stretch of no input",
	);

	window.dispatchEvent(
		new window.KeyboardEvent("keydown", { key: "a", bubbles: true }),
	);
	assert.equal(
		isIdle(window),
		false,
		"any real input must pop it back out of idle immediately",
	);
});

test("holding a key counts as input: idle must not fire while its ring is still growing", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	// A held key deliberately skips triggerInteraction (that's the whole
	// point of the growth effect), so it's the one input path that could
	// silently let the idle countdown run to completion underneath it.
	window.dispatchEvent(
		new window.KeyboardEvent("keydown", {
			key: "a",
			code: "KeyA",
			bubbles: true,
		}),
	);
	for (let i = 0; i < 220; i++) {
		window.dispatchEvent(
			new window.KeyboardEvent("keydown", {
				key: "a",
				code: "KeyA",
				repeat: true,
				bubbles: true,
			}),
		);
		await sleep(50);
	}

	assert.equal(
		isIdle(window),
		false,
		"must not go idle while a key is actively held",
	);
	assert.equal(
		window.document.getElementById("heldKeyRing").style.transition,
		"none",
		"the ring must still be actively growing — i.e. the screen was visibly busy the whole time",
	);
});

test("the page going hidden stops the idle ticker, and coming back re-arms the countdown", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	await sleep(IDLE_MS);
	assert.equal(isIdle(window), true);

	// jsdom's visibilityState is a prototype getter pinned to "visible";
	// shadowing it on the instance lets the handler see each state.
	const setVisibility = (value) =>
		Object.defineProperty(window.document, "visibilityState", {
			value,
			configurable: true,
		});

	setVisibility("hidden");
	window.document.dispatchEvent(new window.Event("visibilitychange"));
	assert.equal(
		isIdle(window),
		false,
		"a page nobody can see must not keep running the attract ticker",
	);

	setVisibility("visible");
	window.document.dispatchEvent(new window.Event("visibilitychange"));
	assert.equal(
		isIdle(window),
		false,
		"coming back doesn't jump straight to idle",
	);
	await sleep(IDLE_MS);
	assert.equal(
		isIdle(window),
		true,
		"but the countdown must be re-armed, so it can liven up again",
	);
});

test("prefers-reduced-motion opts out of attract mode entirely", async (t) => {
	const window = bootApp();
	t.after(() => window.close());

	// Attract mode is motion that starts on its own, with nobody having
	// touched anything — exactly what this preference opts out of.
	window.matchMedia = (query) => ({
		matches: query.includes("prefers-reduced-motion"),
		media: query,
		addEventListener() {},
		removeEventListener() {},
	});

	await startSession(window);
	await sleep(IDLE_MS);
	assert.equal(
		isIdle(window),
		false,
		"must never liven up on its own for someone who asked for less motion",
	);
});

test("opening the settings panel holds off idle indefinitely; closing it re-arms the countdown", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	// Open the panel well before the timeout would fire.
	window.document.getElementById("parentGateToggle").click(); // gate is on by default; turn it off for a plain click
	window.document.getElementById("settingsButton").click();
	assert.equal(
		window.document.getElementById("sidePanel").classList.contains("open"),
		true,
	);

	// Wait past the point the original countdown would have fired: it must
	// not have, since the session is paused while the panel is open.
	await sleep(IDLE_MS);
	assert.equal(
		isIdle(window),
		false,
		"idle must never trigger while the panel is open",
	);

	// Closing the panel resumes play and re-arms the countdown from here.
	window.document.getElementById("closePanel").click();
	await sleep(IDLE_MS);
	assert.equal(
		isIdle(window),
		true,
		"the countdown must restart once play resumes after the panel closes",
	);
});

test("ending the session cancels the idle countdown for good", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	// End well before the timeout would fire.
	window.document.getElementById("parentGateToggle").click();
	window.document.getElementById("settingsButton").click();
	window.document.getElementById("endSessionButton").click();
	assert.equal(
		window.document.getElementById("keyStage").classList.contains("hidden"),
		true,
		"session should have ended",
	);

	await sleep(IDLE_MS);
	assert.equal(
		isIdle(window),
		false,
		"idle must never trigger once the session that armed it has ended",
	);
});
