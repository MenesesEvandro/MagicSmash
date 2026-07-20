// Regression tests for the parent gate, driving the built app.js (the real
// shipped artifact — `npm test` rebuilds it first) inside jsdom. Covers the
// flows that review rounds found fragile: click vs. hold, keyboard holds,
// key-repeat leaking after the panel opens, and the language-selector lock.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The gate's hold duration in app.js, plus a little slack. */
const HOLD_MS = 2000;

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

/**
 * jsdom has no PointerEvent constructor; the gate's handlers only read
 * `type`, `bubbles`, and `pointerId`, so a plain Event dressed up with a
 * pointerId exercises them faithfully.
 */
function pointerEvent(window, type, pointerId) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	event.pointerId = pointerId;
	return event;
}

function keyEvent(window, key, { repeat = false } = {}) {
	return new window.KeyboardEvent("keydown", {
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

const panelOpen = (window) =>
	window.document.getElementById("sidePanel").classList.contains("open");

test("keyboard hold opens the panel, and the still-held key cannot close it", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const gear = window.document.getElementById("settingsButton");
	gear.focus();

	gear.dispatchEvent(keyEvent(window, "Enter"));
	assert.equal(
		gear.classList.contains("gate-holding"),
		true,
		"keydown should start the hold",
	);
	// OS key repeat must not disturb the hold in progress.
	gear.dispatchEvent(keyEvent(window, "Enter", { repeat: true }));
	assert.equal(gear.classList.contains("gate-holding"), true);

	await sleep(HOLD_MS + 200);
	assert.equal(panelOpen(window), true, "full hold should open the panel");

	// Focus moved to the close button while Enter is still physically down:
	// its repeats must be swallowed (defaultPrevented blocks the native
	// activation that would close the panel right after it opened).
	const closeButton = window.document.getElementById("closePanel");
	const repeatPress = keyEvent(window, "Enter", { repeat: true });
	closeButton.dispatchEvent(repeatPress);
	assert.equal(
		repeatPress.defaultPrevented,
		true,
		"repeats must be swallowed while the key is still held",
	);
	assert.equal(panelOpen(window), true, "panel must stay open");

	// Releasing the key ends the suppression: a fresh, deliberate Enter is
	// back to normal (it may close the panel — that's the parent's choice).
	window.dispatchEvent(
		new window.KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
	);
	const freshPress = keyEvent(window, "Enter");
	closeButton.dispatchEvent(freshPress);
	assert.equal(
		freshPress.defaultPrevented,
		false,
		"a fresh press after keyup must not be suppressed",
	);
});

test("another key's keyup cannot end the held key's repeat suppression", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const gear = window.document.getElementById("settingsButton");
	gear.focus();
	gear.dispatchEvent(keyEvent(window, "Enter"));
	await sleep(HOLD_MS + 200);
	assert.equal(panelOpen(window), true);
	const closeButton = window.document.getElementById("closePanel");

	// A toddler's finger lifting elsewhere on the keyboard: keyup of a key
	// that is not the one being held.
	window.dispatchEvent(
		new window.KeyboardEvent("keyup", { key: "x", bubbles: true }),
	);
	const repeatAfterOtherKeyup = keyEvent(window, "Enter", { repeat: true });
	closeButton.dispatchEvent(repeatAfterOtherKeyup);
	assert.equal(
		repeatAfterOtherKeyup.defaultPrevented,
		true,
		"the held key's repeats must stay swallowed past another key's keyup",
	);
	assert.equal(panelOpen(window), true, "panel must stay open");

	// The suppression is scoped to the held key: another key's repeat is not
	// the swallow's business (the open panel already keeps it out of play).
	const otherKeyRepeat = keyEvent(window, "x", { repeat: true });
	window.dispatchEvent(otherKeyRepeat);
	assert.equal(otherKeyRepeat.defaultPrevented, false);

	// Only the held key's own keyup ends it.
	window.dispatchEvent(
		new window.KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
	);
	const repeatAfterRealKeyup = keyEvent(window, "Enter", { repeat: true });
	closeButton.dispatchEvent(repeatAfterRealKeyup);
	assert.equal(
		repeatAfterRealKeyup.defaultPrevented,
		false,
		"releasing the held key ends the suppression",
	);
});

/**
 * Boots, starts a session, opens the panel through a full keyboard hold of
 * Enter, and proves the repeat suppression is engaged — the shared setup
 * for the lost-context tests, whose final negative assertions would pass
 * vacuously if the suppression had never been active in the first place.
 */
async function openPanelByKeyboardHold(window) {
	await startSession(window);
	const gear = window.document.getElementById("settingsButton");
	gear.focus();
	gear.dispatchEvent(keyEvent(window, "Enter"));
	await sleep(HOLD_MS + 200);
	assert.equal(panelOpen(window), true);
	const engaged = keyEvent(window, "Enter", { repeat: true });
	window.document.getElementById("closePanel").dispatchEvent(engaged);
	assert.equal(engaged.defaultPrevented, true, "suppression must be engaged");
}

test("losing the window clears the repeat suppression instead of leaving it stuck", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await openPanelByKeyboardHold(window);

	// Focus leaves the window while Enter is still down: its keyup will
	// never be delivered, so the blur itself must end the suppression.
	window.dispatchEvent(new window.Event("blur"));
	const repeatAfterBlur = keyEvent(window, "Enter", { repeat: true });
	window.document.getElementById("closePanel").dispatchEvent(repeatAfterBlur);
	assert.equal(
		repeatAfterBlur.defaultPrevented,
		false,
		"suppression must not survive the window losing focus",
	);
});

test("the page going hidden clears the repeat suppression too", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await openPanelByKeyboardHold(window);

	// The tab is backgrounded / the device locks while Enter is still down.
	// jsdom's visibilityState is a prototype getter pinned to "visible";
	// shadowing it on the document instance lets the handler see "hidden".
	Object.defineProperty(window.document, "visibilityState", {
		value: "hidden",
		configurable: true,
	});
	window.document.dispatchEvent(new window.Event("visibilitychange"));
	const repeatAfterHidden = keyEvent(window, "Enter", { repeat: true });
	window.document.getElementById("closePanel").dispatchEvent(repeatAfterHidden);
	assert.equal(
		repeatAfterHidden.defaultPrevented,
		false,
		"suppression must not survive the page going hidden",
	);
});

test("keys are inert while the panel is open — no effects, no stats, no stolen Tab", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	// Gate state is irrelevant to this rule; turn it off to open the panel
	// with a plain click and keep the test fast.
	window.document.getElementById("parentGateToggle").click();
	await startSession(window);
	window.document.getElementById("settingsButton").click();
	assert.equal(panelOpen(window), true);

	const sparksBefore =
		window.document.querySelectorAll("#sparkles .spark").length;
	const pressesBefore =
		window.document.getElementById("sessionPresses").textContent;
	window.dispatchEvent(keyEvent(window, "x"));
	assert.equal(
		window.document.querySelectorAll("#sparkles .spark").length,
		sparksBefore,
		"no effects may spawn behind the open panel",
	);
	assert.equal(
		window.document.getElementById("sessionPresses").textContent,
		pressesBefore,
		"no presses may be counted behind the open panel",
	);

	const tabPress = keyEvent(window, "Tab");
	window.dispatchEvent(tabPress);
	assert.equal(
		tabPress.defaultPrevented,
		false,
		"Tab must keep its default so the open panel stays keyboard-navigable",
	);

	// Closing the panel hands the keyboard back to the game.
	window.document.getElementById("closePanel").click();
	window.dispatchEvent(keyEvent(window, "y"));
	assert.equal(
		window.document.querySelectorAll("#sparkles .spark").length > sparksBefore,
		true,
		"play must resume once the panel closes",
	);
});

test("with the gate up, a plain tap only shows the hold-to-open hint", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	window.document.getElementById("settingsButton").click();
	assert.equal(panelOpen(window), false, "a tap must not open the panel");
	assert.equal(
		window.document.getElementById("gateHint").classList.contains("hidden"),
		false,
		"the hint must show so the parent learns the gesture",
	);
});

test("a pointer hold opens the panel; an early release does not", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	await startSession(window);
	const gear = window.document.getElementById("settingsButton");

	// Released after half the hold: never opens.
	gear.dispatchEvent(pointerEvent(window, "pointerdown", 1));
	assert.equal(gear.classList.contains("gate-holding"), true);
	await sleep(500);
	gear.dispatchEvent(pointerEvent(window, "pointerup", 1));
	assert.equal(gear.classList.contains("gate-holding"), false);
	await sleep(HOLD_MS);
	assert.equal(panelOpen(window), false, "a cancelled hold must never open");

	// Held to completion: opens — and a toddler's concurrent touch landing
	// mid-hold must not break it.
	gear.dispatchEvent(pointerEvent(window, "pointerdown", 1));
	await sleep(300);
	gear.dispatchEvent(pointerEvent(window, "pointerdown", 2));
	gear.dispatchEvent(pointerEvent(window, "pointerup", 2));
	await sleep(HOLD_MS);
	assert.equal(panelOpen(window), true, "a completed hold must open");
});

test("the language selector locks and unlocks with the gate and session", async (t) => {
	const window = bootApp();
	t.after(() => window.close());
	const select = window.document.getElementById("languageSelect");
	assert.equal(select.disabled, false, "welcome screen: unlocked");

	await startSession(window);
	assert.equal(select.disabled, true, "mid-play with the gate on: locked");

	// Pass the gate; the paused, panel-open state unlocks it.
	const gear = window.document.getElementById("settingsButton");
	gear.dispatchEvent(pointerEvent(window, "pointerdown", 1));
	await sleep(HOLD_MS + 200);
	assert.equal(panelOpen(window), true);
	assert.equal(select.disabled, false, "panel open (paused): unlocked");

	window.document.getElementById("closePanel").click();
	assert.equal(select.disabled, true, "play resumed: locked again");

	// Turning the gate off releases the selector mid-play too. The toggle
	// lives in the panel, but its handler doesn't care who fired it.
	window.document.getElementById("parentGateToggle").click();
	assert.equal(select.disabled, false, "gate off: unlocked");

	// Back on, then end the session through the panel: unlocked for good.
	window.document.getElementById("parentGateToggle").click();
	assert.equal(select.disabled, true);
	gear.dispatchEvent(pointerEvent(window, "pointerdown", 1));
	await sleep(HOLD_MS + 200);
	window.document.getElementById("endSessionButton").click();
	assert.equal(select.disabled, false, "session over: unlocked");
});
