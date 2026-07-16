import { playTone } from "./audio.js";
import { $ } from "./dom.js";
import {
	animateBackground,
	makeLetterTrail,
	makePointerTrail,
	makeSparkles,
	makeThemeMechanic,
} from "./effects.js";
import { languages, t } from "./i18n.js";
import { data, saveData, state } from "./state.js";
import { themeIcons } from "./themes.js";

export function formatTimer(seconds) {
	const safe = Math.max(0, Math.floor(seconds));
	return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function displayKey(event) {
	if (event.key === " ") return "●";
	if (event.key.length === 1) return event.key.toUpperCase();
	const labels = {
		Enter: "↵",
		Backspace: "←",
		Tab: "↹",
		ArrowUp: "↑",
		ArrowDown: "↓",
		ArrowLeft: "←",
		ArrowRight: "→",
		Shift: "⇧",
		Control: "⌃",
		Alt: "⌥",
		Meta: "⌘",
		CapsLock: "⇪",
		Escape: "⎋",
		Delete: "⌦",
		Insert: "↳",
		Home: "↖",
		End: "↘",
		PageUp: "⇞",
		PageDown: "⇟",
		ContextMenu: "☰",
		ScrollLock: "⇳",
		NumLock: "⇭",
		Pause: "Ⅱ",
		PrintScreen: "▣",
	};
	return labels[event.key] || (event.key.startsWith("F") ? event.key : "✦");
}

export function keyName(event) {
	if (event.key === " ") return t("space");
	return displayKey(event);
}

export function updateStats() {
	const keyEntries = Object.entries(data.keyCounts || {});
	const favourite = keyEntries.sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
	$("#totalPresses").textContent = data.totalPresses.toLocaleString();
	$("#totalMinutes").textContent = `${Math.floor(data.totalSeconds / 60)} min`;
	$("#totalUnique").textContent = data.uniqueKeys.length;
	$("#bestSpeed").textContent = data.bestSpeed;
	$("#favoriteKey").textContent = favourite;
	$("#sessionPresses").textContent = state.sessionPresses;
	$("#sessionStreak").textContent = state.bestStreak;
}

export function updateStreak() {
	const word = state.streak === 1 ? t("sequence") : t("sequences");
	$("#streakText").textContent = `${state.streak} ${word}`;
}

export function resetSession() {
	state.sessionPresses = 0;
	state.sessionKeys = new Set();
	state.streak = 0;
	state.bestStreak = 0;
	state.lastKeyTime = 0;
	state.startedAt = Date.now();
	state.elapsedBeforePause = 0;
	$("#keyOrb").textContent = "?";
	$("#keyName").textContent = t("letsPlay");
	$("#encouragement").textContent = "";
	updateStreak();
	updateStats();
}

export function startGame() {
	if (state.playing) return;
	resetSession();
	state.playing = true;
	$("#welcomeCard").classList.add("hidden");
	$("#keyStage").classList.remove("hidden");
	$("#sessionChip").classList.remove("hidden");
	$("#bottomPrompt").classList.add("hidden");
	tick();
	state.timerId = window.setInterval(tick, 500);
}

export function tick() {
	if (!state.playing) return;
	const elapsed = (Date.now() - state.startedAt) / 1000;
	if (Number(data.duration) === 0) {
		$("#timer").textContent = `+${formatTimer(elapsed)}`;
		return;
	}
	const remaining = Number(data.duration) * 60 - elapsed;
	$("#timer").textContent = formatTimer(remaining);
	if (remaining <= 0) endGame();
}

export function endGame() {
	if (!state.playing) return;
	const elapsed = Math.max(
		1,
		Math.round((Date.now() - state.startedAt) / 1000),
	);
	state.playing = false;
	clearInterval(state.timerId);
	data.totalSeconds += elapsed;
	data.bestSpeed = Math.max(
		data.bestSpeed,
		Math.round((state.sessionPresses / elapsed) * 60),
	);
	saveData();
	updateStats();
	$("#keyStage").classList.add("hidden");
	$("#sessionChip").classList.add("hidden");
	$("#bottomPrompt").classList.remove("hidden");
	$("#endPresses").textContent = state.sessionPresses;
	$("#endUnique").textContent = state.sessionKeys.size;
	$("#endStreak").textContent = state.bestStreak;
	$("#endDialog").showModal();
}

export function pressKey(event) {
	if (Object.keys(languages).length === 0) return;
	if (
		event.key === "Tab" ||
		event.key === " " ||
		event.key.startsWith("Arrow") ||
		["Alt", "Escape"].includes(event.key)
	)
		event.preventDefault();
	triggerInteraction(displayKey(event), keyName(event), event, { sound: true });
}

export function triggerInteraction(
	displayed,
	label,
	point,
	{ sound = false, pointer = false, burst = false } = {},
) {
	if (!state.playing) startGame();
	const effectPoint = pointer ? point : randomEffectPoint();
	const now = Date.now();
	state.streak = now - state.lastKeyTime < 1600 ? state.streak + 1 : 1;
	state.bestStreak = Math.max(state.bestStreak, state.streak);
	state.lastKeyTime = now;
	state.sessionPresses++;
	state.sessionKeys.add(displayed);
	data.totalPresses++;
	data.keyCounts[displayed] = (data.keyCounts[displayed] || 0) + 1;
	if (!data.uniqueKeys.includes(displayed)) data.uniqueKeys.push(displayed);
	$("#keyOrb").textContent = displayed;
	$("#keyName").textContent = label;
	$("#encouragement").textContent =
		t("encouragement")[Math.floor(Math.random() * t("encouragement").length)];
	const orb = $("#keyOrb");
	orb.classList.remove("bounce");
	void orb.offsetWidth;
	orb.classList.add("bounce");
	if (pointer) makePointerTrail(point);
	if (!pointer || burst) {
		makeSparkles(effectPoint);
		makeLetterTrail(displayed);
	}
	makeThemeMechanic(effectPoint);
	animateBackground();
	updateStreak();
	updateStats();
	if (sound && data.sound) playTone();
	saveData();
}

export function randomEffectPoint() {
	const horizontalPadding = Math.min(80, window.innerWidth * 0.12);
	const topPadding = Math.min(150, window.innerHeight * 0.2);
	return {
		clientX:
			horizontalPadding +
			Math.random() * Math.max(1, window.innerWidth - horizontalPadding * 2),
		clientY:
			topPadding +
			Math.random() * Math.max(1, window.innerHeight - topPadding - 65),
	};
}

export function pressPointer(event) {
	if (
		Object.keys(languages).length === 0 ||
		event.target.closest("button, select, input, label")
	)
		return;
	if (!state.playing) return;
	const isMouseTrail =
		event.type === "pointermove" && event.pointerType === "mouse";
	if (event.type === "pointermove" && !isMouseTrail) return;
	const now = Date.now();
	if (isMouseTrail && now - state.lastPointerTime < 160) return;
	state.lastPointerTime = now;
	event.preventDefault();
	const icons = themeIcons[data.theme];
	const displayed = icons[Math.floor(Math.random() * icons.length)];
	triggerInteraction(displayed, displayed, event, {
		pointer: true,
		burst: event.type === "pointerdown",
		sound: event.type === "pointerdown",
	});
}
