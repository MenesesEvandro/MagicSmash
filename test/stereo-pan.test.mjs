// Regression tests for stereo panning: playTone()'s tone pans left/right
// based on where a pointer tap landed across #playArea, while keyboard
// input always plays centred (it has no natural on-screen X of its own).
// jsdom has no real Web Audio API, so this installs a minimal fake
// AudioContext that records each StereoPannerNode's pan value, then drives
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
	right: 1000,
	bottom: 500,
	width: 1000,
	height: 500,
};

/** A fake Web Audio node: just enough for playTone()'s call chain — every
 * method it invokes exists, and connect() returns whatever it was given so
 * `a.connect(b).connect(c)` keeps working. */
function fakeNode(extra = {}) {
	return { connect: (destination) => destination, ...extra };
}

/** Installs a fake AudioContext on `window` so playTone() runs its real
 * logic instead of hitting the try/catch's audio-unavailable path, and
 * returns the pan value recorded from every StereoPannerNode it creates. */
function installFakeAudioContext(window) {
	const panValues = [];
	window.AudioContext = class {
		constructor() {
			this.currentTime = 0;
			this.destination = fakeNode();
		}
		createOscillator() {
			return fakeNode({
				type: "",
				frequency: { value: 0, exponentialRampToValueAtTime() {} },
				start() {},
				stop() {},
			});
		}
		createGain() {
			return fakeNode({
				gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
			});
		}
		createStereoPanner() {
			const panner = fakeNode({ pan: { value: 0 } });
			panValues.push(panner.pan);
			return panner;
		}
	};
	return panValues;
}

/** Installs a fake AudioContext with no createStereoPanner at all, matching
 * an engine (older iOS Safari) that never shipped StereoPannerNode. Returns
 * a live `played` flag so a test can confirm playTone() still produces
 * sound instead of the fallback throwing and the tone getting silently
 * swallowed by playTone()'s own catch. */
function installFakeAudioContextWithoutPanning(window) {
	let played = false;
	window.AudioContext = class {
		constructor() {
			this.currentTime = 0;
			this.destination = fakeNode();
		}
		createOscillator() {
			return fakeNode({
				type: "",
				frequency: { value: 0, exponentialRampToValueAtTime() {} },
				start() {
					played = true;
				},
				stop() {},
			});
		}
		createGain() {
			return fakeNode({
				gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
			});
		}
	};
	return {
		get played() {
			return played;
		},
	};
}

/** Boots a fresh app instance: real index.html + built app.js in jsdom.
 * @param {(window: object) => object} installAudio Installs whichever fake
 * AudioContext the test needs before the app's own script runs.
 */
function bootApp(installAudio = installFakeAudioContext) {
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
	const audio = installAudio(window);
	const script = window.document.createElement("script");
	script.textContent = appJs;
	window.document.body.appendChild(script);
	window.document.getElementById("playArea").getBoundingClientRect = () => AREA;
	return { window, audio };
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

test("a tap at the play area's left edge pans fully left", async (t) => {
	const { window, audio: panValues } = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.document
		.getElementById("playArea")
		.dispatchEvent(
			pointerEvent(window, "pointerdown", { clientX: 0, clientY: 250 }),
		);

	assert.equal(panValues.at(-1).value, -1);
});

test("a tap at the play area's right edge pans fully right", async (t) => {
	const { window, audio: panValues } = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.document
		.getElementById("playArea")
		.dispatchEvent(
			pointerEvent(window, "pointerdown", { clientX: 1000, clientY: 250 }),
		);

	assert.equal(panValues.at(-1).value, 1);
});

test("a tap in the middle of the play area stays centred", async (t) => {
	const { window, audio: panValues } = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.document
		.getElementById("playArea")
		.dispatchEvent(
			pointerEvent(window, "pointerdown", { clientX: 500, clientY: 250 }),
		);

	assert.equal(panValues.at(-1).value, 0);
});

test("a keyboard press always plays centred, regardless of its random effect point", async (t) => {
	const { window, audio: panValues } = bootApp();
	t.after(() => window.close());
	await startSession(window);

	window.dispatchEvent(
		new window.KeyboardEvent("keydown", {
			key: "a",
			bubbles: true,
			cancelable: true,
		}),
	);

	assert.equal(panValues.at(-1).value, 0);
});

test("falls back to a plain pass-through when the engine has no StereoPannerNode", async (t) => {
	const { window, audio } = bootApp(installFakeAudioContextWithoutPanning);
	t.after(() => window.close());
	await startSession(window);

	window.document
		.getElementById("playArea")
		.dispatchEvent(
			pointerEvent(window, "pointerdown", { clientX: 0, clientY: 250 }),
		);

	assert.equal(
		audio.played,
		true,
		"a tap must still produce sound even when stereo panning isn't supported",
	);
});
