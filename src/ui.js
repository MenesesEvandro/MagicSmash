import { $, $$ } from "./dom.js";
import { createMagicBackground } from "./effects.js";
import {
	pauseSession,
	resumeSession,
	updateStats,
	updateStreak,
} from "./game.js";
import { languages, t } from "./i18n.js";
import { data, saveData, state } from "./state.js";
import { themeIcons, themeNames } from "./themes.js";

const KEY_BOUNCE_DURATION_MS = 340;
/** How long the panel buttons must be held to pass the parent gate. */
export const PARENT_GATE_HOLD_MS = 2000;

/** Exposes JS-owned animation timing to CSS via custom properties on the root element. */
export function applyAnimationSettings() {
	document.documentElement.style.setProperty(
		"--key-bounce-duration-ms",
		`${KEY_BOUNCE_DURATION_MS}ms`,
	);
	document.documentElement.style.setProperty(
		"--parent-gate-hold-ms",
		`${PARENT_GATE_HOLD_MS}ms`,
	);
}

/**
 * Switches the UI language (no-op for unknown codes): sets the document
 * language (mapping the registry's "pt-br" to the standard "pt-BR" tag),
 * retranslates every `[data-i18n]` element (`welcomeTitle` as HTML, the
 * rest as text), refreshes labels that embed translated words, and
 * persists.
 * @param {string} language Language code from the loaded registry.
 */
export function setLanguage(language) {
	if (!languages[language]) return;
	data.language = language;
	document.documentElement.lang = language === "pt-br" ? "pt-BR" : language;
	$("#languageSelect").value = language;
	$$("[data-i18n]").forEach((element) => {
		const key = element.dataset.i18n;
		if (key === "welcomeTitle") element.innerHTML = t(key);
		else element.textContent = t(key);
	});
	const profile = data.profile || t("unnamed");
	$("#profileName").textContent = profile;
	$("#childName").placeholder = t("unnamed");
	updateThemeName();
	updateColorMode();
	updateStreak();
	updateSound();
	updateStats();
	saveData();
}

/**
 * Applies a theme (no-op for unknown ids): sets it on the body's `data-theme`,
 * highlights its picker button, updates the theme-name labels, rebuilds the
 * magic background, and persists.
 * @param {string} theme Theme id from {@link themeIcons}.
 */
export function setTheme(theme) {
	if (!themeIcons[theme]) return;
	data.theme = theme;
	document.body.dataset.theme = theme;
	$$("[data-theme-choice]").forEach((button) => {
		button.classList.toggle("active", button.dataset.themeChoice === theme);
	});
	updateThemeName();
	createMagicBackground();
	saveData();
}

/** Shows the active theme's translated name in the settings panel and quick chip. */
export function updateThemeName() {
	const selectedThemeName = t(themeNames[data.theme]);
	$("#themeName").textContent = selectedThemeName;
	$("#quickThemeName").textContent = selectedThemeName;
}

/**
 * Sets the color mode and persists it; anything other than "dark" means light.
 * @param {string} mode
 */
export function setColorMode(mode) {
	data.colorMode = mode === "dark" ? "dark" : "light";
	document.body.dataset.mode = data.colorMode;
	updateColorMode();
	saveData();
}

/** Highlights the picker button matching the current color mode. */
export function updateColorMode() {
	$$("[data-mode-choice]").forEach((button) => {
		button.classList.toggle(
			"active",
			button.dataset.modeChoice === data.colorMode,
		);
	});
}

/**
 * Maps the letter-size setting (0 small, 2 large, otherwise default) onto
 * body classes and syncs the slider position.
 */
export function updateLetterSize() {
	document.body.classList.toggle(
		"small-letters",
		Number(data.letterSize) === 0,
	);
	document.body.classList.toggle(
		"large-letters",
		Number(data.letterSize) === 2,
	);
	$("#letterSize").value = data.letterSize;
}

/** Syncs every duration select with the stored session duration. */
export function updateDuration() {
	$$("[data-duration-select]").forEach((select) => {
		select.value = data.duration;
	});
}

/** Syncs the sound toggles. */
export function updateSound() {
	$$("[data-sound-toggle]").forEach((toggle) => {
		toggle.checked = data.sound;
	});
}

/** Syncs the vibration toggles. */
export function updateVibration() {
	$$("[data-vibration-toggle]").forEach((toggle) => {
		toggle.checked = data.vibration;
	});
}

/** Syncs the kaleidoscope toggle. */
export function updateKaleidoscope() {
	$$("[data-kaleidoscope-toggle]").forEach((toggle) => {
		toggle.checked = data.kaleidoscope;
	});
}

/** Syncs the parent gate toggle. */
export function updateParentGate() {
	$$("[data-parent-gate-toggle]").forEach((toggle) => {
		toggle.checked = data.parentGate;
	});
}

let gateHintTimerId = null;

/**
 * Briefly shows the "hold to open" hint next to the panel buttons, so a
 * parent whose tap was just blocked by the gate learns the gesture instead
 * of assuming the buttons are broken. Repeated taps restart the timer.
 */
export function showParentGateHint() {
	const hint = $("#gateHint");
	hint.classList.remove("hidden");
	clearTimeout(gateHintTimerId);
	gateHintTimerId = window.setTimeout(() => hint.classList.add("hidden"), 1600);
}

/** Shows the end-session button only while a session is running. */
export function updateEndSessionButton() {
	$("#endSessionButton").classList.toggle("hidden", !state.playing);
}

/**
 * Opens the side panel on either the settings or the stats view, with
 * matching title and eyebrow text, freshly rendered stats, and focus moved
 * to the close button. Pauses a running session's clock — the parent's
 * attention is here now, not on the play area, so a timed session shouldn't
 * silently drain in the background while they look around.
 * @param {string} type `"settings"` for settings; anything else shows stats.
 */
export function openPanel(type) {
	const isSettings = type === "settings";
	$("#settingsPanel").classList.toggle("hidden", !isSettings);
	$("#statsPanel").classList.toggle("hidden", isSettings);
	$("#panelTitle").textContent = t(isSettings ? "settings" : "stats");
	$("#panelEyebrow").textContent = isSettings ? t("caregivers") : t("allTime");
	pauseSession();
	updateStats();
	updateEndSessionButton();
	$("#sidePanel").classList.add("open");
	$("#sidePanel").setAttribute("aria-hidden", "false");
	$("#scrim").classList.add("show");
	$("#closePanel").focus();
}

/** Hides the side panel and its scrim, and resumes a paused session's clock. */
export function closePanel() {
	$("#sidePanel").classList.remove("open");
	$("#sidePanel").setAttribute("aria-hidden", "true");
	$("#scrim").classList.remove("show");
	resumeSession();
}

/**
 * Reveals the update banner. The first click on "Update now" disables the
 * button and invokes `applyUpdate`.
 * @param {() => void} applyUpdate Called when the user confirms the update.
 */
export function showUpdateBanner(applyUpdate) {
	$("#updateBanner").classList.remove("hidden");
	$("#updateNowButton").addEventListener(
		"click",
		(event) => {
			event.currentTarget.disabled = true;
			applyUpdate();
		},
		{ once: true },
	);
}

/**
 * Shows the iOS install tip; its dismiss button hides the tip and invokes
 * `onDismiss` once.
 * @param {() => void} onDismiss Called when the user dismisses the tip.
 */
export function showIosInstallTip(onDismiss) {
	$("#iosInstallTip").classList.remove("hidden");
	$("#dismissIosTip").addEventListener(
		"click",
		() => {
			$("#iosInstallTip").classList.add("hidden");
			onDismiss();
		},
		{ once: true },
	);
}

/**
 * Shares the session results (presses and best streak): via the Web Share
 * API when present (a dismissed share sheet is ignored), otherwise by
 * copying text and URL to the clipboard and briefly swapping the share
 * button label to a confirmation. Does nothing when neither is available.
 */
export async function shareSessionResults() {
	const text = t("shareText")
		.replace("{presses}", state.sessionPresses)
		.replace("{streak}", state.bestStreak);
	const shareData = { title: "Magic Smash", text, url: window.location.href };

	if (navigator.share) {
		try {
			await navigator.share(shareData);
		} catch {
			/* The user closing the share sheet isn't a failure to react to. */
		}
		return;
	}

	if (!navigator.clipboard) return;
	try {
		await navigator.clipboard.writeText(`${text} ${shareData.url}`);
		const label = $("#shareButton").querySelector("[data-i18n]");
		const original = label.textContent;
		label.textContent = t("linkCopied");
		setTimeout(() => {
			label.textContent = original;
		}, 2000);
	} catch {
		/* Clipboard access can be denied by the browser; nothing more to try. */
	}
}
