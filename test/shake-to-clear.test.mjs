// Regression tests for shake-to-clear: a strong DeviceMotion reading wipes
// the background, any sparkles or theme effects still mid-animation, and
// the doodle canvas, with a "whoosh" sound — distinct from ending the
// session. jsdom ships a bare DeviceMotionEvent constructor with no
// requestPermission static (matching every non-iOS browser), so tests that
// need the iOS gate add that method themselves. Drives the built app.js
// (the real shipped artifact — `npm test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A fake Web Audio node: just enough for playShakeSwoosh()'s call chain —
 * every method it invokes exists, and connect() returns whatever it was
 * given so `a.connect(b).connect(c)` keeps working. */
function fakeNode(extra = {}) {
	return { connect: (destination) => destination, ...extra };
}

/** Installs a fake AudioContext so playShakeSwoosh() runs its real logic
 * instead of hitting the try/catch's audio-unavailable path, and returns
 * how many times its noise source has been started. */
function installFakeAudioContext(window) {
	let started = 0;
	window.AudioContext = class {
		constructor() {
			this.currentTime = 0;
			this.sampleRate = 44100;
			this.destination = fakeNode();
		}
		createBuffer(_channels, length) {
			return {
				getChannelData: () => new Float32Array(length),
			};
		}
		createBufferSource() {
			return fakeNode({
				buffer: null,
				start: () => {
					started++;
				},
				stop() {},
			});
		}
		createBiquadFilter() {
			return fakeNode({
				type: "",
				frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
			});
		}
		createGain() {
			return fakeNode({
				gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
			});
		}
	};
	return () => started;
}

/** Fills #sparkles and #themeEffects with a stand-in "still animating"
 * element each, so a test can tell whether clearEffects() actually ran. */
function seedLiveEffects(window) {
	window.document.getElementById("sparkles").innerHTML =
		'<span class="spark"></span>';
	window.document.getElementById("themeEffects").innerHTML =
		'<span class="theme-effect"></span>';
}

/**
 * @param {object} [storedData] Pre-seeded localStorage data, as if saved by
 * an earlier session.
 * @param {(window: Window) => void} [beforeBoot] Runs right before the app
 * script executes — the only way to have something (like a stubbed iOS
 * `requestPermission`) already in place for the app's own boot-time code
 * to see, since that code runs synchronously as the script is appended.
 */
function bootApp(storedData, beforeBoot) {
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	const { window } = dom;
	if (storedData) {
		window.localStorage.setItem(
			"magic-smash-data-v1",
			JSON.stringify(storedData),
		);
	}
	const calls = [];
	const context = Object.fromEntries(
		["setTransform", "clearRect"].map((method) => [
			method,
			(...args) => calls.push([method, ...args]),
		]),
	);
	window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
	window.HTMLCanvasElement.prototype.getContext = () => context;
	const getSound = installFakeAudioContext(window);
	beforeBoot?.(window);
	const script = window.document.createElement("script");
	script.textContent = appJs;
	window.document.body.append(script);
	return { window, calls, getSound };
}

function shakeEvent(window, { x, y, z }) {
	const event = new window.Event("devicemotion");
	Object.assign(event, { accelerationIncludingGravity: { x, y, z } });
	return event;
}

async function enableViaToggle(window) {
	window.document.getElementById("shakeToClearToggle").click();
	await sleep(0);
}

test("a strong shake clears sparkles, theme effects, the background, and the doodle canvas", async (t) => {
	const { window, calls, getSound } = bootApp();
	t.after(() => window.close());
	await enableViaToggle(window);
	seedLiveEffects(window);
	const magicLayerBefore =
		window.document.getElementById("magicLayer").innerHTML;
	// resizeDoodle() already cleared the canvas once during boot; only calls
	// made from here on are the shake's own.
	calls.length = 0;

	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));

	assert.equal(
		window.document.getElementById("sparkles").children.length,
		0,
		"sparkles still mid-animation should be wiped",
	);
	assert.equal(
		window.document.getElementById("themeEffects").children.length,
		0,
		"theme effects still mid-animation should be wiped",
	);
	assert.notEqual(
		window.document.getElementById("magicLayer").innerHTML,
		magicLayerBefore,
		"the background should be regenerated, not just left as-is",
	);
	assert.ok(
		calls.some(([method]) => method === "clearRect"),
		"the doodle canvas should be cleared too",
	);
	assert.equal(getSound(), 1, "the whoosh sound should play once");
});

test("a small jitter does not trigger a clear", async (t) => {
	const { window, calls, getSound } = bootApp();
	t.after(() => window.close());
	await enableViaToggle(window);
	seedLiveEffects(window);
	calls.length = 0;

	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 1, y: 0.5, z: 0 }));

	assert.equal(window.document.getElementById("sparkles").children.length, 1);
	assert.equal(
		calls.some(([method]) => method === "clearRect"),
		false,
	);
	assert.equal(getSound(), 0);
});

test("a burst of shakes inside the cooldown window only clears once", async (t) => {
	const { window, getSound } = bootApp();
	t.after(() => window.close());
	await enableViaToggle(window);

	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));

	assert.equal(
		getSound(),
		1,
		"a rapid burst of readings should still count as one shake",
	);
});

test("turning the setting off stops it reacting to further shakes", async (t) => {
	const { window, getSound } = bootApp();
	t.after(() => window.close());
	await enableViaToggle(window);
	window.document.getElementById("shakeToClearToggle").click();

	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));

	assert.equal(getSound(), 0, "no listener should still be attached");
});

test("turning the setting off and back on right away doesn't leave the old cooldown suppressing the next real shake", async (t) => {
	const { window, getSound } = bootApp();
	t.after(() => window.close());
	await enableViaToggle(window);
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));
	assert.equal(getSound(), 1, "sanity check: the first shake should fire");

	// Off, then straight back on — quick enough that, without resetting the
	// cooldown, the next shake would still fall inside the old window.
	window.document.getElementById("shakeToClearToggle").click();
	await enableViaToggle(window);
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));

	assert.equal(
		getSound(),
		2,
		"a real shake right after re-enabling must not be swallowed by the previous session's cooldown",
	);
});

test("on a platform that gates DeviceMotion, a setting left on from a previous session is turned back off at boot", async (t) => {
	const { window, getSound } = bootApp({ shakeToClear: true }, (win) => {
		win.DeviceMotionEvent.requestPermission = () => Promise.resolve("granted");
	});
	t.after(() => window.close());

	assert.equal(
		window.document.getElementById("shakeToClearToggle").checked,
		false,
		"boot can't silently pass iOS's permission prompt, so the setting must come back unchecked instead of staying checked but inert",
	);
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));
	assert.equal(getSound(), 0, "no listener should have been attached");
});

test("on a platform with no DeviceMotion at all, a setting left on from a previous session is turned back off at boot", async (t) => {
	const { window, getSound } = bootApp({ shakeToClear: true }, (win) => {
		// Most laptops, and some Android tablets, never define this at all —
		// distinct from the iOS case above, which has the constructor but
		// gates it behind requestPermission().
		delete win.DeviceMotionEvent;
	});
	t.after(() => window.close());

	assert.equal(
		window.document.getElementById("shakeToClearToggle").checked,
		false,
		"a listener can never attach here, so the setting must come back unchecked instead of staying checked but inert",
	);
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));
	assert.equal(getSound(), 0, "no listener should have been attached");
});

test("on a platform that gates DeviceMotion, a granted prompt turns the setting on", async (t) => {
	const { window, getSound } = bootApp();
	t.after(() => window.close());
	window.DeviceMotionEvent.requestPermission = () => Promise.resolve("granted");

	await enableViaToggle(window);

	assert.equal(
		window.document.getElementById("shakeToClearToggle").checked,
		true,
	);
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));
	assert.equal(getSound(), 1);
});

test("on a platform that gates DeviceMotion, a denied prompt leaves the setting off", async (t) => {
	const { window, getSound } = bootApp();
	t.after(() => window.close());
	window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");

	await enableViaToggle(window);

	assert.equal(
		window.document.getElementById("shakeToClearToggle").checked,
		false,
		"a denied prompt must snap the toggle back off, not leave it checked but inert",
	);
	window.dispatchEvent(shakeEvent(window, { x: 0, y: 0, z: 0 }));
	window.dispatchEvent(shakeEvent(window, { x: 20, y: 20, z: 20 }));
	assert.equal(getSound(), 0);
});
