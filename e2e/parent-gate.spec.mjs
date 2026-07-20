// Real-browser proof for the parent gate behaviours jsdom can only
// approximate: native activation of the focused close button by a held
// key's OS repeats, real pointer input, and the end-of-session <dialog>
// actually opening. The broad state matrix lives in test/ on jsdom — a
// behaviour belongs here only when the browser itself is what's under test.
import { expect, test } from "@playwright/test";

/** The gate's hold duration in app.js, plus a little slack. */
const HOLD_MS = 2000;

async function startSession(page) {
	await page.goto("/");
	await page.locator("#startButton").click();
	await expect(page.locator("#keyStage")).toBeVisible();
}

const panel = (page) => page.locator("#sidePanel");

test("a held Enter passes the gate and its real repeats cannot close the panel", async ({
	page,
}) => {
	await startSession(page);
	await page.locator("#settingsButton").focus();

	// Hold Enter through the whole gate duration. Playwright marks a second
	// keyboard.down of an already-down key as repeat: true, going through
	// the browser's real input pipeline — including the native activation
	// jsdom cannot exercise.
	await page.keyboard.down("Enter");
	await page.waitForTimeout(HOLD_MS + 300);
	await expect(panel(page)).toHaveClass(/open/);

	// Focus moved to the close button while Enter is still down; these
	// repeats would natively click it if the suppression failed.
	for (let i = 0; i < 3; i++) {
		await page.keyboard.down("Enter");
		await page.waitForTimeout(80);
	}
	await expect(panel(page)).toHaveClass(/open/);

	// Released and pressed again deliberately: native activation must be
	// back, and the focused close button closes the panel.
	await page.keyboard.up("Enter");
	await page.keyboard.press("Enter");
	await expect(panel(page)).not.toHaveClass(/open/);
});

test("a real pointer hold opens the panel; a short press only shows the hint", async ({
	page,
}) => {
	await startSession(page);
	const gear = page.locator("#settingsButton");
	const box = await gear.boundingBox();
	const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

	// A quick real click: blocked, and the hint appears.
	await gear.click();
	await expect(panel(page)).not.toHaveClass(/open/);
	await expect(page.locator("#gateHint")).toBeVisible();

	// A short real press: still nothing.
	await page.mouse.move(center.x, center.y);
	await page.mouse.down();
	await page.waitForTimeout(500);
	await page.mouse.up();
	await page.waitForTimeout(HOLD_MS);
	await expect(panel(page)).not.toHaveClass(/open/);

	// Held to completion: opens.
	await page.mouse.down();
	await page.waitForTimeout(HOLD_MS + 300);
	await page.mouse.up();
	await expect(panel(page)).toHaveClass(/open/);
});

test("ending the session opens the real end-of-session dialog", async ({
	page,
}) => {
	await startSession(page);

	// Pass the gate with a real pointer hold, then end the session from the
	// panel — the recap must arrive as a genuinely open modal <dialog>.
	const gear = page.locator("#settingsButton");
	const box = await gear.boundingBox();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(HOLD_MS + 300);
	await page.mouse.up();
	await expect(panel(page)).toHaveClass(/open/);

	await page.locator("#endSessionButton").click();
	await expect(page.locator("#endDialog")).toBeVisible();
	await expect(page.locator("#endDialog")).toHaveJSProperty("open", true);
});
