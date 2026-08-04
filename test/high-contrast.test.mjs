// Regression tests for high contrast: an opt-in toggle layered on top of
// whichever appearance mode (light or dark) is already active, rather than a
// third mode of its own — so it can end up "positive" (black-on-white, with
// light) or "negative" (white-on-black, with dark) depending on what the
// parent already picked. Drives the built app.js (the real shipped artifact
// — `npm test` rebuilds it first) inside jsdom.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const STORAGE_KEY = "magic-smash-data-v1";

/** Boots a fresh app instance: real index.html + built app.js in jsdom.
 * @param {object} [storedData] Pre-seeded localStorage data, as if saved by
 * an earlier session.
 */
function bootApp(storedData) {
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	const { window } = dom;
	if (storedData) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
	}
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

const isHighContrast = (window) =>
	window.document.body.classList.contains("high-contrast");

test("defaults to off", (t) => {
	const window = bootApp();
	t.after(() => window.close());

	assert.equal(isHighContrast(window), false);
	assert.equal(
		window.document.getElementById("highContrastToggle").checked,
		false,
	);
});

test("turning it on with light mode active layers it on top, rather than replacing light mode", (t) => {
	const window = bootApp();
	t.after(() => window.close());

	window.document.getElementById("highContrastToggle").click();

	assert.equal(isHighContrast(window), true);
	assert.equal(window.document.body.dataset.mode, "light");
});

test("turning it on with dark mode active layers it on top, rather than replacing dark mode", (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.setColorMode("dark");

	window.document.getElementById("highContrastToggle").click();

	assert.equal(isHighContrast(window), true);
	assert.equal(window.document.body.dataset.mode, "dark");
});

test("switching between light and dark preserves the high-contrast toggle", (t) => {
	const window = bootApp();
	t.after(() => window.close());
	window.document.getElementById("highContrastToggle").click();

	window.setColorMode("dark");
	assert.equal(
		isHighContrast(window),
		true,
		"must stay on after switching to dark",
	);

	window.setColorMode("light");
	assert.equal(
		isHighContrast(window),
		true,
		"must stay on after switching back to light",
	);
});

test("turning it off removes it immediately", (t) => {
	const window = bootApp();
	t.after(() => window.close());
	const toggle = window.document.getElementById("highContrastToggle");
	toggle.click();
	assert.equal(
		isHighContrast(window),
		true,
		"sanity check: should be on first",
	);

	toggle.click();

	assert.equal(isHighContrast(window), false);
});

test("a high-contrast setting saved from an earlier session is restored on boot", (t) => {
	const window = bootApp({ highContrast: true, colorMode: "dark" });
	t.after(() => window.close());

	assert.equal(isHighContrast(window), true);
	assert.equal(window.document.body.dataset.mode, "dark");
	assert.equal(
		window.document.getElementById("highContrastToggle").checked,
		true,
	);
});
