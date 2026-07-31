// Regression tests for the edge dead zone: with data.edgeDeadZone on, taps
// within EDGE_DEAD_ZONE_MARGIN_PX of #playArea's edge are ignored — for
// ordinary taps and for Super Smash's touch count alike. Drives the built
// app.js (the real shipped artifact — `npm test` rebuilds it first) inside
// jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stand-in play area size, since jsdom never actually lays anything out
 * (#playArea.getBoundingClientRect() would otherwise be all zeros, which
 * would put every coordinate "past the edge" of a zero-sized rect). */
const AREA = {
	left: 0,
	top: 0,
	right: 1600,
	bottom: 900,
	width: 1600,
	height: 900,
};
/** Comfortably inside AREA's edge margin (must match EDGE_DEAD_ZONE_MARGIN_PX in src/game.js). */
const EDGE_POINT = { clientX: 5, clientY: 450 };
/** Comfortably away from every edge. */
const CENTER_POINT = { clientX: 800, clientY: 450 };
/** Past the small (16px) margin but within the medium/large ones. */
const MID_EDGE_POINT = { clientX: 20, clientY: 450 };

function setEdgeDeadZoneSize(window, value) {
	const slider = window.document.getElementById("edgeDeadZoneSize");
	slider.value = String(value);
	slider.dispatchEvent(new window.Event("input", { bubbles: true }));
}

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

test("with the setting off (default), a tap right at the edge registers normally", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.document
		.getElementById("playArea")
		.dispatchEvent(pointerEvent(window, "pointerdown", EDGE_POINT));

	assert.equal(
		pressCount(window),
		1,
		"an edge tap must count when the setting is off",
	);
});

test("with the setting on, a tap right at the edge is ignored entirely", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	area.dispatchEvent(pointerEvent(window, "pointerdown", EDGE_POINT));

	assert.equal(
		pressCount(window),
		0,
		"an edge tap must not count once the setting is on",
	);
	assert.equal(
		window.document.querySelectorAll("#sparkles .spark").length,
		0,
		"no visual effect should fire for it either",
	);
});

test("with the setting on, a tap away from the edge still registers normally", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	area.dispatchEvent(pointerEvent(window, "pointerdown", CENTER_POINT));

	assert.equal(
		pressCount(window),
		1,
		"the dead zone must only affect the edges, not the whole play area",
	);
});

test("an ignored mouse trail event still advances the pointermove throttle", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	let rectCalls = 0;
	area.getBoundingClientRect = () => {
		rectCalls++;
		return AREA;
	};

	// Regression: two mouse pointermoves along the edge, back to back, must
	// only force one layout — the dead zone ignoring the first must not skip
	// updating the throttle timestamp, or every raw pointermove along the
	// edge would call getBoundingClientRect() instead of one per 160 ms.
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			...EDGE_POINT,
			pointerType: "mouse",
		}),
	);
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			...EDGE_POINT,
			pointerType: "mouse",
		}),
	);

	assert.equal(
		rectCalls,
		1,
		"the second pointermove within 160ms must be throttled before it reaches the dead-zone check",
	);
});

test("with the setting on, an edge tap still gets its default prevented", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	await startSession(window);

	// Regression: a dead-zone-ignored tap must not fall through to the
	// browser's own default (e.g. starting a text selection on the orb),
	// the same as every tap that does register.
	const event = pointerEvent(window, "pointerdown", EDGE_POINT);
	window.document.getElementById("playArea").dispatchEvent(event);

	assert.equal(
		event.defaultPrevented,
		true,
		"ignoring a tap for the dead zone must not skip preventDefault",
	);
});

test("the size slider is disabled until the dead zone setting is on", async (t) => {
	const window = bootApp();
	t.after(() => window.close());

	assert.equal(
		window.document.getElementById("edgeDeadZoneSize").disabled,
		true,
		"the slider must start disabled, since the setting itself starts off",
	);

	window.document.getElementById("edgeDeadZoneToggle").click();

	assert.equal(
		window.document.getElementById("edgeDeadZoneSize").disabled,
		false,
		"turning the setting on must enable its size slider",
	);
});

test("the size slider controls how much of the edge gets ignored", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");

	setEdgeDeadZoneSize(window, 0); // small: 16px
	area.dispatchEvent(pointerEvent(window, "pointerdown", MID_EDGE_POINT));
	assert.equal(
		pressCount(window),
		1,
		"a tap past the small margin must register as an ordinary tap",
	);

	setEdgeDeadZoneSize(window, 2); // large: 48px
	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...MID_EDGE_POINT,
			pointerId: 2,
		}),
	);
	assert.equal(
		pressCount(window),
		1,
		"the same tap must be ignored once the zone is widened to cover it",
	);
});

test("with the setting on, edge touches don't count toward Super Smash's threshold", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	await startSession(window);

	const area = window.document.getElementById("playArea");
	// Four simultaneous touches along the left edge — a whole-hand grip, not
	// a slap — must not add up to a Super Smash the way four centered
	// touches would.
	for (let id = 1; id <= 4; id++) {
		area.dispatchEvent(
			pointerEvent(window, "pointerdown", {
				pointerId: id,
				clientX: 5,
				clientY: 100 + id * 50,
			}),
		);
	}

	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		0,
		"a grip along the edge must not trigger Super Smash",
	);
	assert.equal(
		pressCount(window),
		0,
		"none of the gripping touches should count as presses either",
	);

	// Sanity check: the same four touches, centered, still do trigger it —
	// proving the zero counts above are because of the dead zone, not
	// because Super Smash itself broke.
	for (let id = 5; id <= 8; id++) {
		area.dispatchEvent(
			pointerEvent(window, "pointerdown", {
				pointerId: id,
				clientX: 800,
				clientY: 100 + id * 50,
			}),
		);
	}
	assert.equal(
		window.document.querySelectorAll("#sparkles .super-spark").length,
		40,
		"centered touches must still be able to trigger Super Smash normally",
	);
});
