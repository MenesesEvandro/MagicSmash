import { $, $$ } from "./dom.js";
import { startBackgroundShuffle } from "./effects.js";
import {
	endGame,
	pressKey,
	pressPointer,
	releasePointer,
	startGame,
	updateParentGateLocks,
	updateStats,
} from "./game.js";
import { languages, loadLanguages, populateLanguageSelect, t } from "./i18n.js";
import {
	dismissIosInstallTip,
	linkManifest,
	registerServiceWorker,
	shouldShowIosInstallTip,
} from "./pwa.js";
import { data, initialData, resetStats, saveData, state } from "./state.js";
import { themeIcons } from "./themes.js";
import {
	applyAnimationSettings,
	closePanel,
	openPanel,
	PARENT_GATE_HOLD_MS,
	setColorMode,
	setLanguage,
	setTheme,
	shareSessionResults,
	showIosInstallTip,
	showParentGateHint,
	showUpdateBanner,
	updateDuration,
	updateKaleidoscope,
	updateLetterSize,
	updateParentGate,
	updateSound,
	updateVibration,
} from "./ui.js";

$("#startButton").addEventListener("click", async () => {
	if (!document.fullscreenElement) {
		try {
			await document.documentElement.requestFullscreen();
		} catch {
			/* Full screen is optional if the browser blocks it. */
		}
	}
	startGame();
});
$("#homeButton").addEventListener("click", () => {
	if (!state.playing) window.scrollTo({ top: 0, behavior: "smooth" });
});
window.addEventListener("keydown", pressKey, { passive: false });
$("#playArea").addEventListener("pointerdown", pressPointer, {
	passive: false,
});
$("#playArea").addEventListener("pointermove", pressPointer, {
	passive: false,
});
$("#playArea").addEventListener("pointerup", releasePointer, { passive: true });
$("#playArea").addEventListener("pointercancel", releasePointer, {
	passive: true,
});
$("#playArea").addEventListener("pointerleave", releasePointer, {
	passive: true,
});
/**
 * Whether the parent gate stands between a press and the panels right now:
 * only while the setting is on and a session is actively running. On the
 * welcome screen, or while the panel is already open (session paused), the
 * buttons behave normally — the gate exists to stop a toddler's mid-play
 * taps, not to slow the parent down while they're already in control.
 */
function parentGateActive() {
	return data.parentGate && state.playing && !state.paused;
}

/**
 * The panel-button hold in progress, if any: its button, its timer, and the
 * holder that started it — a pointerId, or "keyboard" for an Enter/Space
 * hold. Only that same holder can cancel it, so a toddler's concurrent taps
 * landing on the buttons can't break the parent's hold partway through.
 */
let gateHold = null;

function cancelGateHold() {
	if (!gateHold) return;
	clearTimeout(gateHold.timerId);
	gateHold.button.classList.remove("gate-holding");
	gateHold = null;
}

/**
 * The key whose hold just opened the panel, from that moment until it is
 * released; null otherwise. Opening the panel moves focus to its close
 * button while the Enter/Space is still physically down, so the OS's key
 * repeats would otherwise natively activate the close button — shutting the
 * panel right after it opened. Swallowing that key's repeats (and only its
 * repeats — a fresh press is a deliberate act) until its own keyup closes
 * the gap; tracking the specific key means some other key's keyup (a
 * toddler's finger lifting elsewhere on the keyboard) can't end the
 * suppression early while the held key is still down.
 */
let swallowRepeatsOfKey = null;
window.addEventListener(
	"keydown",
	(event) => {
		if (event.repeat && event.key === swallowRepeatsOfKey) {
			event.preventDefault();
			event.stopPropagation();
		}
	},
	{ capture: true },
);
window.addEventListener(
	"keyup",
	(event) => {
		if (event.key === swallowRepeatsOfKey) swallowRepeatsOfKey = null;
	},
	{ capture: true },
);
// Once the window loses focus, key events stop being delivered — the held
// key's keyup may simply never arrive, which would leave the suppression
// stuck until some future press of the same key. By the time the app is
// back, the key is long released, so clearing is always the right call.
window.addEventListener("blur", () => {
	swallowRepeatsOfKey = null;
});
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "hidden") swallowRepeatsOfKey = null;
});

function beginGateHold(button, holder, heldKey) {
	button.classList.add("gate-holding");
	gateHold = {
		button,
		holder,
		timerId: window.setTimeout(() => {
			cancelGateHold();
			if (holder === "keyboard") swallowRepeatsOfKey = heldKey;
			openPanel(button.dataset.openPanel);
		}, PARENT_GATE_HOLD_MS),
	};
}

// With the gate down, a plain click opens the panel. With it up, the click
// only shows the "hold to open" hint, and holding the button for
// PARENT_GATE_HOLD_MS — pointer kept down and on the button the whole time,
// with a CSS fill animating the same duration as feedback — is what opens
// it. Deliberately parent-shaped: a toddler's taps are far too brief.
// Holding Enter or Space on the focused button works the same way, so the
// gate never locks out someone who can't use a pointer.
$$("[data-open-panel]").forEach((button) => {
	button.addEventListener("click", () => {
		if (parentGateActive()) {
			showParentGateHint();
			return;
		}
		openPanel(button.dataset.openPanel);
	});
	button.addEventListener("pointerdown", (event) => {
		if (!parentGateActive() || gateHold) return;
		beginGateHold(button, event.pointerId);
	});
	for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
		button.addEventListener(type, (event) => {
			if (gateHold?.button === button && gateHold.holder === event.pointerId)
				cancelGateHold();
		});
	}
	button.addEventListener("keydown", (event) => {
		if (!parentGateActive()) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		// No native click synthesis (the click would only flash the hint),
		// and no play effects from the game's global keydown handler while
		// the parent is deliberately holding the gate open.
		event.preventDefault();
		event.stopPropagation();
		if (event.repeat || gateHold) return;
		beginGateHold(button, "keyboard", event.key);
	});
	button.addEventListener("keyup", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		if (gateHold?.button === button && gateHold.holder === "keyboard") {
			cancelGateHold();
			// Pointer users get the hint from the click that follows a short
			// press; a released key produces no click, so show it here.
			showParentGateHint();
		}
	});
	button.addEventListener("blur", () => {
		if (gateHold?.button === button && gateHold.holder === "keyboard")
			cancelGateHold();
	});
	// A 2-second touch hold is also how browsers open context menus; that
	// would interrupt the hold right before it completes.
	button.addEventListener("contextmenu", (event) => {
		if (parentGateActive()) event.preventDefault();
	});
});
$("#closePanel").addEventListener("click", closePanel);
$("#scrim").addEventListener("click", closePanel);
$("#languageSelect").addEventListener("change", (event) =>
	setLanguage(event.target.value),
);
$$("[data-duration-select]").forEach((select) => {
	select.addEventListener("change", (event) => {
		data.duration = Number(event.target.value);
		updateDuration();
		saveData();
	});
});
$$("[data-theme-choice]").forEach((button) => {
	button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
});
$$("[data-mode-choice]").forEach((button) => {
	button.addEventListener("click", () =>
		setColorMode(button.dataset.modeChoice),
	);
});
$$("[data-sound-toggle]").forEach((toggle) => {
	toggle.addEventListener("change", (event) => {
		data.sound = event.target.checked;
		updateSound();
		saveData();
	});
});
$$("[data-vibration-toggle]").forEach((toggle) => {
	toggle.addEventListener("change", (event) => {
		data.vibration = event.target.checked;
		updateVibration();
		saveData();
	});
});
$$("[data-kaleidoscope-toggle]").forEach((toggle) => {
	toggle.addEventListener("change", (event) => {
		data.kaleidoscope = event.target.checked;
		updateKaleidoscope();
		saveData();
	});
});
$$("[data-parent-gate-toggle]").forEach((toggle) => {
	toggle.addEventListener("change", (event) => {
		data.parentGate = event.target.checked;
		updateParentGate();
		updateParentGateLocks();
		saveData();
	});
});
$("#letterSize").addEventListener("input", (event) => {
	data.letterSize = Number(event.target.value);
	updateLetterSize();
	saveData();
});
$("#fullscreenButton").addEventListener("click", async () => {
	try {
		await document.documentElement.requestFullscreen();
		closePanel();
	} catch {
		/* Browser may deny fullscreen until another gesture. */
	}
});
$("#editProfile").addEventListener("click", () => {
	$("#childName").value = data.profile;
	$("#profileDialog").showModal();
	$("#childName").focus();
});
$("#profileForm").addEventListener("submit", (event) => {
	if (event.submitter?.value !== "save") return;
	data.profile = $("#childName").value.trim();
	$("#profileName").textContent = data.profile || t("unnamed");
	saveData();
});
$("#playAgain").addEventListener("click", () => {
	$("#endDialog").close();
	startGame();
});
$("#goHomeButton").addEventListener("click", () => {
	$("#endDialog").close();
	window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#shareButton").addEventListener("click", () => shareSessionResults());
$("#endSessionButton").addEventListener("click", () => {
	closePanel();
	endGame();
});
$("#resetStats").addEventListener("click", () => {
	if (!window.confirm(t("resetStatsConfirm"))) return;
	const keep = {
		profile: data.profile,
		language: data.language,
		theme: data.theme,
		colorMode: data.colorMode,
		duration: data.duration,
		sound: data.sound,
		vibration: data.vibration,
		kaleidoscope: data.kaleidoscope,
		parentGate: data.parentGate,
		letterSize: data.letterSize,
	};
	resetStats(keep);
	saveData();
	updateStats();
});
document.addEventListener("fullscreenchange", () => {
	if (!document.fullscreenElement) closePanel();
});

/**
 * Boots the UI from persisted settings: loads the language registry, falls
 * back to defaults for language/theme values that no longer exist, applies
 * every setting to the DOM, and starts the background shuffle.
 */
function initializeApp() {
	loadLanguages();
	applyAnimationSettings();
	if (!languages[data.language]) data.language = Object.keys(languages)[0];
	if (!themeIcons[data.theme]) data.theme = initialData.theme;
	populateLanguageSelect();
	setLanguage(data.language);
	setTheme(data.theme);
	setColorMode(data.colorMode);
	startBackgroundShuffle();
	updateDuration();
	updateSound();
	updateVibration();
	updateKaleidoscope();
	updateParentGate();
	updateParentGateLocks();
	updateLetterSize();
	updateStats();
}

linkManifest();
registerServiceWorker(showUpdateBanner);
if (shouldShowIosInstallTip()) showIosInstallTip(dismissIosInstallTip);
initializeApp();
