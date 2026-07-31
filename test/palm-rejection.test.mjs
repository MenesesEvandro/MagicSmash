// Regression tests for palm rejection: with data.palmRejection on, a touch
// whose own contact geometry (PointerEvent width/height) reads as a resting
// forearm or palm is ignored — for ordinary taps and for Super Smash's touch
// count alike. Drives the built app.js (the real shipped artifact — `npm
// test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stand-in play area size, comfortably away from the edge dead zone —
 * this file is only exercising palm rejection, not the edge check. */
const AREA = {
	left: 0,
	top: 0,
	right: 1600,
	bottom: 900,
	width: 1600,
	height: 900,
};
const CENTER = { clientX: 800, clientY: 450 };
/** A fingertip-sized contact, well under PALM_CONTACT_MIN_PX in src/game.js. */
const FINGERTIP = { ...CENTER, pointerType: "touch", width: 20, height: 18 };
/** A forearm/palm-sized contact, at or past that same threshold. */
const PALM = { ...CENTER, pointerType: "touch", width: 90, height: 70 };

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
	window.document.getElementById("playArea").getBoundingClientRect = () => AREA;
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

function pointerEvent(window, type, init) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, init);
	return event;
}

const pressCount = (window) =>
	Number(window.document.getElementById("sessionPresses").textContent);

test("with the setting off (default), a large touch still registers normally", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.document
		.getElementById("playArea")
		.dispatchEvent(pointerEvent(window, "pointerdown", PALM));

	assert.equal(
		pressCount(window),
		1,
		"a large touch must count when the setting is off",
	);
});

test("with the setting on, a large touch is ignored entirely", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("palmRejectionToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	area.dispatchEvent(pointerEvent(window, "pointerdown", PALM));

	assert.equal(
		pressCount(window),
		0,
		"a large touch must not count once the setting is on",
	);
	assert.equal(
		window.document.querySelectorAll("#sparkles .spark").length,
		0,
		"no visual effect should fire for it either",
	);
});

test("with the setting on, an ordinary fingertip touch still registers normally", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("palmRejectionToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	area.dispatchEvent(pointerEvent(window, "pointerdown", FINGERTIP));

	assert.equal(
		pressCount(window),
		1,
		"palm rejection must only affect large contacts, not ordinary taps",
	);
});

test("with the setting on, a large touch still gets its default prevented", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("palmRejectionToggle").click();
	await startSession(window);

	// Regression, same as the edge dead zone: an ignored touch must not fall
	// through to the browser's own default (e.g. starting a text selection).
	const event = pointerEvent(window, "pointerdown", PALM);
	window.document.getElementById("playArea").dispatchEvent(event);

	assert.equal(
		event.defaultPrevented,
		true,
		"ignoring a touch for palm rejection must not skip preventDefault",
	);
});

test("with the setting on, mouse and pen input are never treated as a palm", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("palmRejectionToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	// A huge width/height only matters for touch — mouse and pen always
	// report 1 in real browsers, but this proves the pointerType gate itself
	// is what protects them, not just realistic event shapes.
	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER,
			pointerType: "mouse",
			width: 999,
			height: 999,
		}),
	);

	assert.equal(
		pressCount(window),
		1,
		"a mouse click must never be rejected as a palm, however large its reported size",
	);
});

test("with the setting on, a resting palm doesn't count toward Super Smash's threshold", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("palmRejectionToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	// Four simultaneous palm-sized contacts — a resting hand, not an
	// excited slap — must not add up to a Super Smash the way four
	// fingertip touches would.
	for (let id = 1; id <= 4; id++) {
		area.dispatchEvent(
			pointerEvent(window, "pointerdown", {
				...PALM,
				pointerId: id,
				clientY: 100 + id * 50,
			}),
		);
	}

	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		0,
		"palm-sized contacts must not trigger Super Smash",
	);
	assert.equal(
		pressCount(window),
		0,
		"none of the palm contacts should count as presses either",
	);

	// Sanity check: the same four touches, fingertip-sized, still do
	// trigger it — proving the zero counts above are because of palm
	// rejection, not because Super Smash itself broke.
	for (let id = 5; id <= 8; id++) {
		area.dispatchEvent(
			pointerEvent(window, "pointerdown", {
				...FINGERTIP,
				pointerId: id,
				clientY: 100 + id * 50,
			}),
		);
	}
	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		40,
		"fingertip touches must still be able to trigger Super Smash normally",
	);
});
