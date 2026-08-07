// Regression tests for prefers-reduced-motion cutting down particle counts,
// not just animation duration: makeSparkles(), makeThemeMechanic(), and
// makeSuperSmash() all spawn roughly half as many particles (rounded, never
// below 1) when the visitor asked the OS for less motion. Drives the built
// app.js (the real shipped artifact — `npm test` rebuilds it first) inside
// jsdom.
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

/** Boots a fresh app instance: real index.html + built app.js in jsdom.
 * @param {boolean} [reducedMotion] Stubs window.matchMedia to report the OS
 * preference for less motion, the same way idle-attract.test.mjs does.
 */
function bootApp(reducedMotion = false) {
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
	if (reducedMotion) {
		window.matchMedia = (query) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener() {},
			removeEventListener() {},
		});
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

const ordinarySparkCount = (window) =>
	window.document.querySelectorAll("#sparkles .spark:not(.super-spark)").length;
const superSparkCount = (window) =>
	window.document.querySelectorAll("#sparkles .super-spark").length;
const themeEffectCount = (window) =>
	window.document.querySelectorAll("#themeEffects .theme-effect").length;

test("a tap spawns 5 sparks normally, 3 with reduced motion", async (t) => {
	const normal = bootApp();
	t.after(() => normal.close());
	await startSession(normal);
	normal.document
		.getElementById("playArea")
		.dispatchEvent(pointerEvent(normal, "pointerdown", CENTER_POINT));
	assert.equal(ordinarySparkCount(normal), 5);

	const reduced = bootApp(true);
	t.after(() => reduced.close());
	await startSession(reduced);
	reduced.document
		.getElementById("playArea")
		.dispatchEvent(pointerEvent(reduced, "pointerdown", CENTER_POINT));
	assert.equal(ordinarySparkCount(reduced), 3);
});

test("Farm's theme mechanic spawns 3 effects normally, 2 with reduced motion", async (t) => {
	const normal = bootApp();
	t.after(() => normal.close());
	normal.setTheme("farm");
	await startSession(normal);
	normal.document
		.getElementById("playArea")
		.dispatchEvent(pointerEvent(normal, "pointerdown", CENTER_POINT));
	assert.equal(themeEffectCount(normal), 3);

	const reduced = bootApp(true);
	t.after(() => reduced.close());
	reduced.setTheme("farm");
	await startSession(reduced);
	reduced.document
		.getElementById("playArea")
		.dispatchEvent(pointerEvent(reduced, "pointerdown", CENTER_POINT));
	assert.equal(themeEffectCount(reduced), 2);
});

test("Super Smash spawns 40 sparks normally, 20 with reduced motion", async (t) => {
	const normal = bootApp();
	t.after(() => normal.close());
	await startSession(normal);
	const normalArea = normal.document.getElementById("playArea");
	for (let id = 1; id <= 4; id++) {
		normalArea.dispatchEvent(
			pointerEvent(normal, "pointerdown", {
				pointerId: id,
				clientX: 100 + id * 10,
				clientY: 100,
			}),
		);
	}
	assert.equal(superSparkCount(normal), 40);

	const reduced = bootApp(true);
	t.after(() => reduced.close());
	await startSession(reduced);
	const reducedArea = reduced.document.getElementById("playArea");
	for (let id = 1; id <= 4; id++) {
		reducedArea.dispatchEvent(
			pointerEvent(reduced, "pointerdown", {
				pointerId: id,
				clientX: 100 + id * 10,
				clientY: 100,
			}),
		);
	}
	assert.equal(superSparkCount(reduced), 20);
});
