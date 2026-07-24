// Regression tests for Super Smash (a whole-hand slap: 4+ simultaneous
// touches), driving the built app.js (the real shipped artifact — `npm
// test` rebuilds it first) inside jsdom. Covers what review found broken:
// the burst bypassing triggerInteraction entirely (no stats, no streak, no
// persistence) and activePointers surviving past a session boundary.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Matches SUPER_SMASH_TOUCH_THRESHOLD in src/game.js. */
const TOUCH_THRESHOLD = 4;

/** Boots a fresh app instance: real index.html + built app.js in jsdom. */
function bootApp() {
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	const { window } = dom;
	// jsdom may lack <dialog>.showModal; the end-of-session dialog needs it.
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

/**
 * jsdom has no PointerEvent constructor; the handlers under test only read
 * `type`, `bubbles`, and the properties in `init` (`pointerId`, `clientX`,
 * `clientY`), so a plain Event carrying them exercises real handlers
 * faithfully.
 */
function pointerEvent(window, type, init) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, init);
	return event;
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

/** Fires `count` simultaneous pointerdowns (distinct pointerIds) on `#playArea`. */
function slap(window, count, { startId = 1 } = {}) {
	const area = window.document.getElementById("playArea");
	for (let id = startId; id < startId + count; id++) {
		area.dispatchEvent(
			pointerEvent(window, "pointerdown", {
				pointerId: id,
				clientX: 100 + id,
				clientY: 100,
			}),
		);
	}
}

test("the touch that fires Super Smash counts as its own press, like any other interaction", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const pressCount = () =>
		Number(window.document.getElementById("sessionPresses").textContent);

	// The first three fingers land below the threshold, each an ordinary tap
	// that already counts on its own — not what's under test here.
	slap(window, TOUCH_THRESHOLD - 1);
	await sleep(20);
	const beforeFinalTouch = pressCount();

	// The fourth finger crosses the threshold and fires Super Smash instead
	// of an ordinary tap — it must still register as a press of its own.
	slap(window, 1, { startId: TOUCH_THRESHOLD });
	await sleep(20);

	assert.equal(
		pressCount(),
		beforeFinalTouch + 1,
		"the Super Smash touch itself must count as a press",
	);
	const saved = JSON.parse(window.localStorage.getItem("magic-smash-data-v1"));
	assert.equal(
		saved.totalPresses,
		beforeFinalTouch + 1,
		"it must persist to localStorage like any other press",
	);
});

test("Super Smash draws its screen-wide burst instead of the ordinary effects", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	slap(window, TOUCH_THRESHOLD);
	await sleep(20);

	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		40,
		"the big burst must fire",
	);
	assert.equal(
		window.document.querySelectorAll("#themeEffects .super-smash-emoji").length,
		1,
	);
});

test("kaleidoscope mode does not mirror the Super Smash burst", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	// makeSuperSmash is called directly in triggerInteraction's superSmash
	// branch, bypassing kaleidoscopePoints() — deliberately: the burst
	// already covers the whole screen (spread: 800, 40 sparks) on its own,
	// so mirroring it would only double an already screen-wide effect. This
	// locks that choice in against a future refactor routing it through
	// kaleidoscopePoints() by accident.
	window.document.getElementById("kaleidoscopeToggle").click();
	assert.equal(
		JSON.parse(window.localStorage.getItem("magic-smash-data-v1")).kaleidoscope,
		true,
		"kaleidoscope must actually be on for this test to mean anything",
	);
	await startSession(window);

	slap(window, TOUCH_THRESHOLD);
	await sleep(20);

	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		40,
		"the burst count must stay exactly one copy, not mirrored",
	);
	assert.equal(
		window.document.querySelectorAll("#themeEffects .super-smash-emoji").length,
		1,
		"the giant emoji must stay a single copy too",
	);
});

test("fewer than the threshold never fires Super Smash", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	slap(window, TOUCH_THRESHOLD - 1);
	await sleep(20);

	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		0,
	);
});

test("activePointers is cleared when a session ends, not just when one starts", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	// Three fingers land and stay down — one short of the threshold — then
	// the session ends without a pointerup for any of them (a toddler
	// walking away mid-slap, or the timer running out).
	slap(window, TOUCH_THRESHOLD - 1);
	window.document.getElementById("endSessionButton").click();

	// A new session starts fresh: send exactly `threshold - 1` new touches
	// (distinct pointerIds) and confirm Super Smash does NOT fire — proving
	// the old ones were actually cleared, not merely masked by pointerId
	// collisions with the previous session's fingers.
	await startSession(window);
	slap(window, TOUCH_THRESHOLD - 1, { startId: 101 });
	await sleep(20);
	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		0,
		"stale pointers from the ended session must not count toward the new one's threshold",
	);
});
