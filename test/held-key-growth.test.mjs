// Regression tests for the held-key growth effect: an OS key-repeat now
// grows a ring around the key orb instead of spamming a full effect burst.
// Drives the built app.js (the real shipped artifact — `npm test` rebuilds
// it first) inside jsdom.
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

function keyEvent(window, type, key, { repeat = false } = {}) {
	return new window.KeyboardEvent(type, {
		key,
		repeat,
		bubbles: true,
		cancelable: true,
	});
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

const ringOpacity = (window) =>
	Number(window.document.getElementById("heldKeyRing").style.opacity || 0);

test("a key repeat does not spam a new interaction", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	await sleep(20);
	const pressesAfterFirstPress = Number(
		window.document.getElementById("sessionPresses").textContent,
	);
	assert.equal(pressesAfterFirstPress, 1, "the first press counts normally");

	for (let i = 0; i < 5; i++) {
		window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));
	}
	await sleep(60);

	assert.equal(
		Number(window.document.getElementById("sessionPresses").textContent),
		1,
		"repeats of a held key must not count as more presses",
	);
	const saved = JSON.parse(window.localStorage.getItem("magic-smash-data-v1"));
	assert.equal(
		saved.keyCounts.A,
		1,
		"repeats must not inflate key counts either",
	);
});

test("a held key grows the ring, and releasing it starts the ring fading back out", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	assert.equal(
		ringOpacity(window),
		0,
		"no growth yet from the first, non-repeat press",
	);

	window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));
	await sleep(100);
	const grownOpacity = ringOpacity(window);
	assert.ok(grownOpacity > 0, "the ring must have grown while the key repeats");

	window.dispatchEvent(keyEvent(window, "keyup", "a"));
	const ring = window.document.getElementById("heldKeyRing");
	assert.equal(
		ring.style.opacity,
		"0",
		"releasing the key must start the ring back toward invisible",
	);
	assert.ok(
		ring.style.transition.includes("opacity"),
		"the release must be a transition, not an instant snap",
	);
});

test("growth is not infinite: it pops at the screen's edge and starts a new cycle instead of plateauing", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));

	// One cycle (HELD_KEY_GROW_MS + HELD_KEY_POP_MS in src/game.js) is
	// 1750ms; sampling opacity every 100ms for 2.4s spans a full cycle and
	// into a second one, however the exact scale/timing constants tune out.
	const ring = window.document.getElementById("heldKeyRing");
	const samples = [];
	for (let i = 0; i < 24; i++) {
		await sleep(100);
		samples.push(Number(ring.style.opacity || 0));
	}

	assert.equal(
		ring.style.transition,
		"none",
		"still held the whole time — never released, so never actually stopped",
	);
	const droppedThenRose = samples.some(
		(value, i) =>
			i > 0 &&
			value < samples[i - 1] - 0.2 &&
			samples.slice(i).some((later) => later > value + 0.1),
	);
	assert.ok(
		droppedThenRose,
		`opacity must fall back down (a new cycle resetting) and climb again, not only ever climb or hold at max: ${samples.map((v) => v.toFixed(2)).join(", ")}`,
	);
});

test("a different key interrupts the current growth instead of adding to it", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));
	await sleep(100);
	const grownForA = ringOpacity(window);
	assert.ok(grownForA > 0);

	// A different key starts pressing (and repeating) before "a" was ever
	// released — its growth must restart from zero, not keep A's progress.
	window.dispatchEvent(keyEvent(window, "keydown", "b"));
	window.dispatchEvent(keyEvent(window, "keydown", "b", { repeat: true }));
	const ring = window.document.getElementById("heldKeyRing");
	assert.equal(
		ring.style.transition,
		"none",
		"the interrupting key's growth must restart instantly, no fade-in from the old value",
	);
	assert.ok(
		ringOpacity(window) < grownForA,
		"growth for the new key must restart near zero, not continue from A's progress",
	);

	// a's keyup must not touch b's still-running growth — the release
	// transition only ever gets set by stopHeldKeyGrowth(), so "still none"
	// after waiting, with opacity having kept climbing, is what proves b's
	// loop was never interrupted by it.
	const beforeAsKeyup = ringOpacity(window);
	window.dispatchEvent(keyEvent(window, "keyup", "a"));
	await sleep(60);
	assert.equal(
		ring.style.transition,
		"none",
		"a's keyup must not affect b's growth, which is still running",
	);
	assert.ok(
		ringOpacity(window) > beforeAsKeyup,
		"b's growth must have kept climbing through a's keyup",
	);

	// Only b's own keyup can stop it.
	window.dispatchEvent(keyEvent(window, "keyup", "b"));
	assert.notEqual(
		ring.style.transition,
		"none",
		"b's own keyup must be the one that finally stops it",
	);
});

test("opening the settings panel mid-hold stops the growth", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	// The parent gate is on by default and would swallow this test's plain
	// click into just a hint; turn it off so the click opens the panel.
	window.document.getElementById("parentGateToggle").click();
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));
	await sleep(100);
	assert.ok(ringOpacity(window) > 0);

	window.document.getElementById("settingsButton").click();
	const ring = window.document.getElementById("heldKeyRing");
	assert.equal(
		ring.style.opacity,
		"0",
		"opening the panel must stop the growth like a keyup would",
	);
});

test("ending the session mid-hold stops the growth", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));
	await sleep(100);
	assert.ok(ringOpacity(window) > 0);

	window.document.getElementById("endSessionButton").click();
	const ring = window.document.getElementById("heldKeyRing");
	assert.equal(ring.style.opacity, "0");
});

test("losing the window mid-hold stops the growth", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(keyEvent(window, "keydown", "a"));
	window.dispatchEvent(keyEvent(window, "keydown", "a", { repeat: true }));
	await sleep(100);
	assert.ok(ringOpacity(window) > 0);

	window.dispatchEvent(new window.Event("blur"));
	const ring = window.document.getElementById("heldKeyRing");
	assert.equal(
		ring.style.opacity,
		"0",
		"a held key's keyup may never arrive once focus is gone — blur must stop it defensively",
	);
});
