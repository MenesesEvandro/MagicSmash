// Regression tests for trail sparks scaling with drag speed: a slow drag
// leaves a big, lingering spark, a fast one a small, quick one, and a spark
// with no drag to measure a speed from (a tap's own, or the very first move
// with no prior point on record) falls back to the plain CSS default.
// Drives the built app.js (the real shipped artifact — `npm test` rebuilds
// it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AREA = {
	left: 0,
	top: 0,
	right: 1600,
	bottom: 900,
	width: 1600,
	height: 900,
};
const CENTER_POINT = { clientX: 800, clientY: 450 };
/** Past the 160ms pointermove throttle. */
const PAST_THROTTLE_WINDOW_MS = 200;

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
}

function pointerEvent(window, type, init) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, init);
	return event;
}

const lastTrailStyle = (window) => {
	const sparks = window.document.querySelectorAll("#sparkles .pointer-trail");
	return sparks[sparks.length - 1].style;
};

test("a slow drag leaves a big, lingering spark", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "mouse",
		}),
	);
	await sleep(PAST_THROTTLE_WINDOW_MS);
	// A couple of pixels over ~200ms: barely moving at all.
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: CENTER_POINT.clientX + 2,
			clientY: CENTER_POINT.clientY,
			pointerType: "mouse",
		}),
	);

	const style = lastTrailStyle(window);
	assert.equal(style.getPropertyValue("--trail-scale"), "1.6");
	assert.equal(style.getPropertyValue("--trail-duration"), "0.9s");
});

test("a fast drag leaves a small, quick spark", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "mouse",
		}),
	);
	await sleep(PAST_THROTTLE_WINDOW_MS);
	// Hundreds of pixels over that same ~200ms: a fast flick.
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: CENTER_POINT.clientX + 600,
			clientY: CENTER_POINT.clientY,
			pointerType: "mouse",
		}),
	);

	const style = lastTrailStyle(window);
	assert.equal(style.getPropertyValue("--trail-scale"), "0.65");
	assert.equal(style.getPropertyValue("--trail-duration"), "0.45s");
});

test("a move with no prior point on record falls back to the plain CSS default", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	// No pointerdown first — the very first pointer event of the session.
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			...CENTER_POINT,
			pointerType: "mouse",
		}),
	);

	const style = lastTrailStyle(window);
	assert.equal(style.getPropertyValue("--trail-scale"), "");
	assert.equal(style.getPropertyValue("--trail-duration"), "");
});

test("a tap's own incidental spark uses the plain CSS default too", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "mouse",
		}),
	);

	const style = lastTrailStyle(window);
	assert.equal(style.getPropertyValue("--trail-scale"), "");
	assert.equal(style.getPropertyValue("--trail-duration"), "");
});
