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
	right: 1200,
	bottom: 800,
	width: 1200,
	height: 800,
};

function pointerEvent(window, type, init) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, init);
	return event;
}

function bootApp() {
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	const { window } = dom;
	const calls = [];
	const context = Object.fromEntries(
		[
			"setTransform",
			"clearRect",
			"save",
			"restore",
			"beginPath",
			"arc",
			"fill",
			"moveTo",
			"lineTo",
			"stroke",
		].map((method) => [method, (...args) => calls.push([method, ...args])]),
	);
	window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
	window.HTMLCanvasElement.prototype.getContext = () => context;
	window.document.getElementById("playArea").getBoundingClientRect = () => AREA;
	const script = window.document.createElement("script");
	script.textContent = appJs;
	window.document.body.append(script);
	return { window, calls };
}

test("doodle mode paints a dot and a continuous stroke from a drag", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: 420,
			clientY: 400,
			pointerId: 7,
			pointerType: "touch",
		}),
	);

	assert.ok(calls.some(([method]) => method === "arc"));
	assert.ok(calls.some(([method]) => method === "lineTo"));
});

test("with the mode off, dragging never paints anything", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	window.document.getElementById("startButton").click();
	await sleep(0);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: 420,
			clientY: 400,
			pointerId: 7,
			pointerType: "touch",
		}),
	);

	assert.ok(
		calls.every(([method]) => method !== "arc" && method !== "lineTo"),
		"no theme's own play should draw on the canvas without the mode on",
	);
});

test("a doodle move reuses the same play-area rect for both the dead zone and the stroke", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	window.document.getElementById("edgeDeadZoneToggle").click();
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);
	const area = window.document.getElementById("playArea");
	let rectCalls = 0;
	area.getBoundingClientRect = () => {
		rectCalls++;
		return AREA;
	};

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);
	rectCalls = 0;
	area.dispatchEvent(
		pointerEvent(window, "pointermove", {
			clientX: 420,
			clientY: 400,
			pointerId: 7,
			pointerType: "touch",
		}),
	);

	assert.equal(
		rectCalls,
		1,
		"doodle stroke updates should reuse the same rect instead of doing a second layout read for the dead-zone guard",
	);
	assert.ok(
		calls.some(([method]) => method === "lineTo"),
		"the stroke must still continue drawing with the edge dead zone enabled",
	);
});

test("the mode layers onto whichever theme is already playing, not a theme of its own", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	window.document
		.querySelector('#welcomeCard [data-theme-choice="dinosaurs"]')
		.click();
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);
	const area = window.document.getElementById("playArea");

	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);

	assert.equal(window.document.body.dataset.theme, "dinosaurs");
	assert.ok(
		calls.some(([method]) => method === "arc"),
		"the stroke should still paint on top of the chosen theme",
	);
	assert.ok(
		window.document.querySelectorAll(".theme-effect").length > 0,
		"the theme's own tap effect should still fire alongside the drawing",
	);
});

test("turning the mode off clears the canvas", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);
	const area = window.document.getElementById("playArea");
	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);
	assert.ok(calls.some(([method]) => method === "arc"));
	calls.length = 0;

	window.document.getElementById("doodleModeToggle").click();

	assert.ok(
		calls.some(([method]) => method === "clearRect"),
		"turning the mode off should clear whatever was drawn",
	);
});

test("the doodle panel exposes an explicit clear button for wiping the drawing", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);
	const area = window.document.getElementById("playArea");
	area.dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);
	calls.length = 0;

	const clearButton = window.document.getElementById("clearDoodleButton");
	assert.ok(
		clearButton,
		"there should be an explicit button to clear the drawing",
	);
	clearButton.click();

	assert.ok(
		calls.some(([method]) => method === "clearRect"),
		"the explicit clear control should wipe the drawing when pressed",
	);
});

test("the save button downloads the canvas as a PNG", async (t) => {
	const { window, calls } = bootApp();
	t.after(() => window.close());
	const clicks = [];
	window.HTMLCanvasElement.prototype.toDataURL = () =>
		"data:image/png;base64,x";
	const nativeClick = window.HTMLAnchorElement.prototype.click;
	window.HTMLAnchorElement.prototype.click = function () {
		clicks.push({ href: this.href, download: this.download });
	};
	t.after(() => {
		window.HTMLAnchorElement.prototype.click = nativeClick;
	});
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);
	window.document.getElementById("playArea").dispatchEvent(
		pointerEvent(window, "pointerdown", {
			clientX: 260,
			clientY: 320,
			pointerId: 7,
			pointerType: "touch",
		}),
	);
	calls.length = 0;

	window.document.getElementById("saveDoodleButton").click();

	assert.equal(clicks.length, 1, "the save control should trigger a download");
	assert.match(clicks[0].href, /^data:image\/png/);
	assert.match(clicks[0].download, /^magic-smash-drawing-\d+\.png$/);
});

test("saving does nothing, rather than throwing, when canvas export isn't supported", async (t) => {
	const { window } = bootApp();
	t.after(() => window.close());
	window.HTMLCanvasElement.prototype.toDataURL = () => {
		throw new Error("canvas export not supported");
	};
	window.document.getElementById("doodleModeToggle").click();
	window.document.getElementById("startButton").click();
	await sleep(0);

	// Calling the function directly, rather than going through the button's
	// click handler, is what makes this a real test of the throw: jsdom (like
	// real browsers) swallows an exception raised inside a DOM event listener
	// instead of letting it reach the click() caller, so asserting around a
	// button .click() here would pass whether or not the guard exists.
	assert.doesNotThrow(() => {
		window.saveDoodleArtwork();
	});
});
