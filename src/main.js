import { $, $$ } from "./dom.js";
import { startBackgroundShuffle } from "./effects.js";
import {
	endGame,
	pressKey,
	pressPointer,
	startGame,
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
	setColorMode,
	setLanguage,
	setTheme,
	shareSessionResults,
	showIosInstallTip,
	showUpdateBanner,
	updateDuration,
	updateLetterSize,
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
$$("[data-open-panel]").forEach((button) => {
	button.addEventListener("click", () => openPanel(button.dataset.openPanel));
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
	updateLetterSize();
	updateStats();
}

linkManifest();
registerServiceWorker(showUpdateBanner);
if (shouldShowIosInstallTip()) showIosInstallTip(dismissIosInstallTip);
initializeApp();
