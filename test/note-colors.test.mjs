// Regression tests for note colours: with data.noteColors on, a feedback
// interaction (a keypress, with sound on) sets the key orb's --note-accent
// custom property to one of the fixed per-note colours in NOTE_COLORS
// (src/audio.js), independent of the current theme. Drives the built app.js
// (the real shipped artifact — `npm test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

/** Must match NOTE_COLORS in src/audio.js. */
const NOTE_COLORS = ["#e2503a", "#e0872e", "#d4b02a", "#4a9e5c", "#3d84c6"];

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
	return window;
}

function keyEvent(window, key) {
	return new window.KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
	});
}

function noteAccent(window) {
	return window.document
		.getElementById("keyOrb")
		.style.getPropertyValue("--note-accent");
}

test("with the setting off (default), a keypress never colours the orb by note", (t) => {
	const window = bootApp();
	t.after(() => window.close());

	window.dispatchEvent(keyEvent(window, "a"));

	assert.equal(
		noteAccent(window),
		"",
		"the orb must keep its theme accent when the setting is off",
	);
});

test("with the setting on, a keypress colours the orb with one of the fixed note colours", (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("noteColorsToggle").click();

	window.dispatchEvent(keyEvent(window, "a"));

	assert.ok(
		NOTE_COLORS.includes(noteAccent(window)),
		`expected one of ${NOTE_COLORS.join(", ")}, got ${noteAccent(window)}`,
	);
});

test("turning the setting off clears a colour a previous tap left behind", (t) => {
	const window = bootApp();
	t.after(() => window.close());
	const toggle = window.document.getElementById("noteColorsToggle");
	toggle.click();
	window.dispatchEvent(keyEvent(window, "a"));
	assert.notEqual(
		noteAccent(window),
		"",
		"sanity check: the orb should be coloured before the setting is turned back off",
	);

	toggle.click();

	assert.equal(
		noteAccent(window),
		"",
		"turning the setting off must clear the colour immediately, not just stop updating it",
	);
});

test("with the setting on but sound off, a keypress leaves the orb uncoloured", (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("noteColorsToggle").click();
	window.document.getElementById("soundToggle").click();

	window.dispatchEvent(keyEvent(window, "a"));

	assert.equal(
		noteAccent(window),
		"",
		"with no tone playing, there's nothing for the colour to be tied to",
	);
});
