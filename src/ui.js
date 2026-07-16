import { $, $$ } from "./dom.js";
import { createMagicBackground } from "./effects.js";
import { updateStats, updateStreak } from "./game.js";
import { languages, t } from "./i18n.js";
import { data, saveData, state } from "./state.js";
import { themeIcons, themeNames } from "./themes.js";

const KEY_BOUNCE_DURATION_MS = 340;

export function applyAnimationSettings() {
	document.documentElement.style.setProperty(
		"--key-bounce-duration-ms",
		`${KEY_BOUNCE_DURATION_MS}ms`,
	);
}

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

export function updateThemeName() {
	const selectedThemeName = t(themeNames[data.theme]);
	$("#themeName").textContent = selectedThemeName;
	$("#quickThemeName").textContent = selectedThemeName;
}

export function setColorMode(mode) {
	data.colorMode = mode === "dark" ? "dark" : "light";
	document.body.dataset.mode = data.colorMode;
	updateColorMode();
	saveData();
}

export function updateColorMode() {
	$$("[data-mode-choice]").forEach((button) => {
		button.classList.toggle(
			"active",
			button.dataset.modeChoice === data.colorMode,
		);
	});
}

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

export function updateDuration() {
	$$("[data-duration-select]").forEach((select) => {
		select.value = data.duration;
	});
}

export function updateSound() {
	$$("[data-sound-toggle]").forEach((toggle) => {
		toggle.checked = data.sound;
	});
	$("#quickSoundState").textContent = t(data.sound ? "soundOn" : "soundOff");
}

export function updateEndSessionButton() {
	$("#endSessionButton").classList.toggle("hidden", !state.playing);
}

export function openPanel(type) {
	const isSettings = type === "settings";
	$("#settingsPanel").classList.toggle("hidden", !isSettings);
	$("#statsPanel").classList.toggle("hidden", isSettings);
	$("#panelTitle").textContent = t(isSettings ? "settings" : "stats");
	$("#panelEyebrow").textContent = isSettings ? t("caregivers") : t("allTime");
	updateStats();
	updateEndSessionButton();
	$("#sidePanel").classList.add("open");
	$("#sidePanel").setAttribute("aria-hidden", "false");
	$("#scrim").classList.add("show");
	$("#closePanel").focus();
}

export function closePanel() {
	$("#sidePanel").classList.remove("open");
	$("#sidePanel").setAttribute("aria-hidden", "true");
	$("#scrim").classList.remove("show");
}

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
