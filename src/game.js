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
import { keepScreenAwake, releaseWakeLock } from "./wakelock.js";

/**
 * @param {number} seconds Seconds to format; negatives clamp to zero.
 * @returns {string} MM:SS with zero-padded minutes and seconds.
 */
export function formatTimer(seconds) {
	const safe = Math.max(0, Math.floor(seconds));
	return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * Picks the big character shown on the key orb: "●" for space, the
 * uppercased character for printable keys, a symbol for known special keys,
 * the key's own name when it starts with "F" (function keys), and "✦" for
 * anything unrecognized.
 * @param {KeyboardEvent} event
 * @returns {string}
 */
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

/**
 * Label shown under the orb: the translated word for space, otherwise the
 * same symbol as {@link displayKey}.
 * @param {KeyboardEvent} event
 * @returns {string}
 */
export function keyName(event) {
	if (event.key === " ") return t("space");
	return displayKey(event);
}

/**
 * Refreshes all lifetime and session stat elements from {@link data} and
 * {@link state}, including the most-pressed key ("—" before any press).
 */
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

/** Renders the current streak count with its singular/plural label. */
export function updateStreak() {
	const word = state.streak === 1 ? t("sequence") : t("sequences");
	$("#streakText").textContent = `${state.streak} ${word}`;
}

/**
 * Zeroes all session counters, stamps the session start time, and returns
 * the orb, key label, and encouragement line to their idle text.
 */
export function resetSession() {
	state.sessionPresses = 0;
	state.sessionKeys = new Set();
	state.streak = 0;
	state.bestStreak = 0;
	state.lastKeyTime = 0;
	state.startedAt = Date.now();
	state.elapsedBeforePause = 0;
	state.paused = false;
	$("#keyOrb").textContent = "?";
	$("#keyName").textContent = t("letsPlay");
	$("#encouragement").textContent = "";
	updateStreak();
	updateStats();
}

/**
 * Total seconds elapsed in the current session: time banked from earlier,
 * non-paused segments ({@link state.elapsedBeforePause}) plus the current
 * segment, if one is running. Reading this instead of `state.startedAt`
 * directly is what lets a pause stop the clock without losing track of how
 * much play already happened.
 * @returns {number}
 */
function currentElapsedSeconds() {
	const activeSegment = state.paused
		? 0
		: (Date.now() - state.startedAt) / 1000;
	return state.elapsedBeforePause + activeSegment;
}

/**
 * Starts a play session (no-op if one is already running): resets session
 * state, keeps the screen awake, swaps the welcome card for the key stage,
 * and begins the 500 ms timer tick.
 */
export function startGame() {
	if (state.playing) return;
	resetSession();
	state.playing = true;
	keepScreenAwake();
	$("#welcomeCard").classList.add("hidden");
	$("#keyStage").classList.remove("hidden");
	$("#sessionChip").classList.remove("hidden");
	$("#bottomPrompt").classList.add("hidden");
	tick();
	state.timerId = window.setInterval(tick, 500);
}

/**
 * Timer update: counts up ("+MM:SS") in free-play mode (duration 0),
 * otherwise counts down and ends the game when time runs out. A no-op while
 * paused, though in practice {@link pauseSession} already stops the interval
 * that would call this.
 */
export function tick() {
	if (!state.playing || state.paused) return;
	const elapsed = currentElapsedSeconds();
	if (Number(data.duration) === 0) {
		$("#timer").textContent = `+${formatTimer(elapsed)}`;
		return;
	}
	const remaining = Number(data.duration) * 60 - elapsed;
	$("#timer").textContent = formatTimer(remaining);
	if (remaining <= 0) endGame();
}

/**
 * Pauses the running clock (no-op if idle or already paused): banks the
 * elapsed time so far into {@link state.elapsedBeforePause} and stops the
 * tick interval, freezing the displayed timer. Meant for whenever the
 * parent's attention — and the settings/stats panel — is open instead of the
 * play area, so a timed session doesn't silently drain in the background.
 */
export function pauseSession() {
	if (!state.playing || state.paused) return;
	state.elapsedBeforePause = currentElapsedSeconds();
	state.paused = true;
	clearInterval(state.timerId);
}

/**
 * Resumes a paused clock (no-op if idle or not paused): restarts the active
 * segment from now, re-renders the timer immediately, and restarts the tick
 * interval.
 */
export function resumeSession() {
	if (!state.playing || !state.paused) return;
	state.paused = false;
	state.startedAt = Date.now();
	tick();
	state.timerId = window.setInterval(tick, 500);
}

/**
 * Ends the session (no-op when idle): releases the screen wake lock, folds
 * elapsed time (minimum one second) and best presses-per-minute into the
 * lifetime stats, persists them, restores the welcome screen, and opens the
 * end-of-session dialog.
 */
export function endGame() {
	if (!state.playing) return;
	const elapsed = Math.max(1, Math.round(currentElapsedSeconds()));
	state.playing = false;
	state.paused = false;
	clearInterval(state.timerId);
	releaseWakeLock();
	data.totalSeconds += elapsed;
	data.bestSpeed = Math.max(
		data.bestSpeed,
		Math.round((state.sessionPresses / elapsed) * 60),
	);
	saveData();
	updateStats();
	$("#keyStage").classList.add("hidden");
	$("#sessionChip").classList.add("hidden");
	$("#welcomeCard").classList.remove("hidden");
	$("#bottomPrompt").classList.remove("hidden");
	$("#endPresses").textContent = state.sessionPresses;
	$("#endUnique").textContent = state.sessionKeys.size;
	$("#endStreak").textContent = state.bestStreak;
	$("#endDialog").showModal();
}

/**
 * Global keydown handler; inert until languages are loaded. Suppresses the
 * browser default for keys that would scroll or move focus (Tab, space,
 * arrows, Alt, Escape), then feeds the press to {@link triggerInteraction}
 * with sound.
 * @param {KeyboardEvent} event
 */
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

/**
 * Registers one interaction and plays all of its feedback: starts a session
 * if needed, updates streaks (presses under 1.6 s apart chain) and per-key
 * counters, shows the key with a random encouragement phrase, fires the
 * visual effects, optionally plays a tone, and persists.
 * @param {string} displayed Character shown on the orb and tracked in stats.
 * @param {string} label Text for the key-name line.
 * @param {{clientX?: number, clientY?: number}} point Effect origin for
 * pointer interactions; keyboard interactions use a random point instead.
 * @param {object} [options]
 * @param {boolean} [options.sound=false] Play a tone (still gated by the sound setting).
 * @param {boolean} [options.pointer=false] Pointer interaction: draw a trail
 * at `point` and skip the sparkle/letter burst unless `burst` is set.
 * @param {boolean} [options.burst=false] Fire the sparkle/letter burst even
 * for a pointer interaction.
 */
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

/**
 * @returns {{clientX: number, clientY: number}} Random viewport point,
 * padded away from the edges and top so effects spawn in comfortable view.
 */
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

/**
 * Pointer handler for the play area; inert until languages are loaded, a
 * session is running, and the target is not a control. Interactions display
 * a random icon from the current theme: taps and clicks (pointerdown) act
 * like a full keypress with sound, while mouse movement only leaves a
 * trail, throttled to one icon per 160 ms.
 * @param {PointerEvent} event
 */
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
