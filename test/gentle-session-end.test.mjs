// Regression tests for the gentle session end: inside the last 15 seconds
// of a timed session, the play area dims and new key/tap effects stop
// firing, instead of the key stage just vanishing mid-keystroke the instant
// the clock hits zero. Fast-forwards by shifting Date.now() rather than
// waiting in real time, and drives the built app.js (the real shipped
// artifact — `npm test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const STORAGE_KEY = "magic-smash-data-v1";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Boots a fresh app instance: real index.html + built app.js in jsdom.
 * @param {object} [storedData] Pre-seeded localStorage data, as if saved by
 * an earlier session.
 */
function bootApp(storedData) {
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	const { window } = dom;
	if (storedData) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
	}
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

/** Shifts every later Date.now() call in `window` forward by `ms`, so
 * currentElapsedSeconds() sees a session as further along than any real
 * wall-clock waiting would need. */
function fastForwardBy(window, ms) {
	const real = window.Date.now.bind(window.Date);
	window.Date.now = () => real() + ms;
}

const isWindingDown = (window) =>
	window.document.body.classList.contains("winding-down");
const pressCount = (window) =>
	Number(window.document.getElementById("sessionPresses").textContent);

function keyEvent(window, key) {
	return new window.KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
	});
}

test("stays off with plenty of time left", async (t) => {
	const window = bootApp({ duration: 3 });
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(50);

	fastForwardBy(window, 60 * 1000); // 60s of a 180s session: nowhere close.
	window.tick();

	assert.equal(isWindingDown(window), false);
});

test("begins inside the last 15 seconds", async (t) => {
	const window = bootApp({ duration: 3 });
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(50);

	fastForwardBy(window, 170 * 1000); // 170s of 180s: 10s remain.
	window.tick();

	assert.equal(isWindingDown(window), true);
});

test("a keypress during wind-down doesn't register as a press", async (t) => {
	const window = bootApp({ duration: 3 });
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(50);
	fastForwardBy(window, 170 * 1000);
	window.tick();
	assert.equal(
		isWindingDown(window),
		true,
		"sanity check: should be winding down",
	);

	window.dispatchEvent(keyEvent(window, "a"));

	assert.equal(
		pressCount(window),
		0,
		"a key pressed while winding down must not fire a new effect",
	);
});

test("ending the session clears the dim, even mid-wind-down", async (t) => {
	const window = bootApp({ duration: 3 });
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(50);
	fastForwardBy(window, 170 * 1000);
	window.tick();
	assert.equal(
		isWindingDown(window),
		true,
		"sanity check: should be winding down",
	);

	window.endGame();

	assert.equal(isWindingDown(window), false);
});

test("free play (no duration) never winds down", async (t) => {
	const window = bootApp({ duration: 0 });
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(50);

	fastForwardBy(window, 60 * 60 * 1000); // a full hour of free play.
	window.tick();

	assert.equal(isWindingDown(window), false);
});

test("starting a fresh session never begins already dimmed", async (t) => {
	const window = bootApp({ duration: 3 });
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(50);
	fastForwardBy(window, 170 * 1000);
	window.tick();
	window.endGame();

	window.startGame();

	assert.equal(isWindingDown(window), false);
});
