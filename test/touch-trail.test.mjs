// Regression tests for the touch drag trail: a finger dragged across
// #playArea now leaves a sparkle trail via pointermove, the same way a
// dragged mouse already did — pen is deliberately left out of scope. Drives
// the built app.js (the real shipped artifact — `npm test` rebuilds it
// first) inside jsdom.
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

const trailCount = (window) =>
	window.document.querySelectorAll("#sparkles .pointer-trail").length;
const sparkCount = (window) =>
	window.document.querySelectorAll("#sparkles .spark").length;

// The initial pointerdown always leaves its own trail spark and sets
// state.lastPointerTime, regardless of pointer type — that part isn't new.
// A pointermove dispatched right after it, with no real time elapsed, would
// fall inside the *same* 160ms throttle window the tap itself just started
// and get silently dropped no matter what pointerType it carries — not a
// meaningful test of the drag trail itself. Waiting past that window first
// is what actually exercises the pointermove path under test.
const PAST_THROTTLE_WINDOW_MS = 200;

test("a finger dragged across the play area leaves a trail", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "touch",
		}),
	);
	const afterTap = trailCount(window);
	await sleep(PAST_THROTTLE_WINDOW_MS);
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: 850,
			clientY: 460,
			pointerType: "touch",
		}),
	);

	assert.equal(
		trailCount(window),
		afterTap + 1,
		"the dragged touch move must add its own trail spark",
	);
});

test("a dragged touch move leaves a trail spark only, not the tap's full sparkle burst", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "touch",
		}),
	);
	const sparksAfterTap = sparkCount(window);
	await sleep(PAST_THROTTLE_WINDOW_MS);
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: 850,
			clientY: 460,
			pointerType: "touch",
		}),
	);

	assert.equal(
		sparkCount(window),
		sparksAfterTap,
		"a trail move must not also fire the multi-spark tap burst, same as a mouse trail",
	);
});

test("rapid touch moves are throttled to one trail spark per 160ms", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "touch",
		}),
	);
	const afterTap = trailCount(window);
	await sleep(PAST_THROTTLE_WINDOW_MS);
	// The first move past the window registers; the burst right behind it,
	// well inside 160ms of that first one, must not add any more.
	for (let x = 810; x <= 850; x += 10) {
		area.dispatchEvent(
			pointerEvent(window, "pointermove", {
				clientX: x,
				clientY: 450,
				pointerType: "touch",
			}),
		);
	}

	assert.equal(
		trailCount(window),
		afterTap + 1,
		"back-to-back moves inside the same throttle window must only draw one spark",
	);
});

test("pen movement is still ignored, same as before", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			...CENTER_POINT,
			pointerType: "pen",
		}),
	);
	const afterTap = trailCount(window);
	await sleep(PAST_THROTTLE_WINDOW_MS);
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: 850,
			clientY: 460,
			pointerType: "pen",
		}),
	);

	assert.equal(
		trailCount(window),
		afterTap,
		"a dragged pen move must not add another trail spark",
	);
});
