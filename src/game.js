import { playTone } from "./audio.js";
import { $ } from "./dom.js";
import {
	animateBackground,
	makeLetterTrail,
	makePointerTrail,
	makeSparkles,
	makeSuperSmash,
	makeThemeMechanic,
	resetIdleTimer,
	stopIdleTimer,
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
	state.activePointers.clear();
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
 * Enables or disables the top-bar language selector to match the parent
 * gate. While the gate stands (setting on, session running, not paused), a
 * mid-play tap on the select would pop the browser's native dropdown over
 * the game — and a hold gesture can't guard a `<select>`, so disabling it
 * is what closes that last ungated top-bar control. It comes back the
 * moment the gate drops: welcome screen, panel open, or session over.
 */
export function updateParentGateLocks() {
	$("#languageSelect").disabled =
		data.parentGate && state.playing && !state.paused;
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
	updateParentGateLocks();
	resetIdleTimer();
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
	updateParentGateLocks();
	stopHeldKeyGrowth();
	stopIdleTimer();
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
	updateParentGateLocks();
	resetIdleTimer();
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
	state.activePointers.clear();
	clearInterval(state.timerId);
	releaseWakeLock();
	updateParentGateLocks();
	stopHeldKeyGrowth();
	stopIdleTimer();
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
 * Global keydown handler; inert until languages are loaded and while the
 * side panel is open. Suppresses the browser default for keys that would
 * scroll or move focus (Tab, space, arrows, Alt, Escape). A fresh press
 * feeds {@link triggerInteraction} with feedback (sound and/or vibration,
 * each per its own setting); an OS key-repeat from a held key doesn't —
 * see {@link startHeldKeyGrowth} — so a key leaned on doesn't spam a full
 * effect burst hundreds of times a second.
 * @param {KeyboardEvent} event
 */
export function pressKey(event) {
	if (Object.keys(languages).length === 0) return;
	// The open side panel takes the keyboard with it: keys belong to the
	// parent navigating the panel, not to the game — no effects or stats
	// spawning behind the scrim (including from the key repeats of an
	// Enter/Space still held after passing the parent gate), and no
	// preventDefault below stealing Tab from the panel's own controls.
	if (state.paused || $("#sidePanel").classList.contains("open")) return;
	if (
		event.key === "Tab" ||
		event.key === " " ||
		event.key.startsWith("Arrow") ||
		["Alt", "Escape"].includes(event.key)
	)
		event.preventDefault();
	if (event.repeat) {
		// A held key is input like any other, even though it deliberately
		// skips triggerInteraction below (and with it the idle reset every
		// other interaction gets): without this, leaning on one key long
		// enough would let the attract mode fire while its ring is still
		// visibly growing.
		resetIdleTimer();
		startHeldKeyGrowth(heldKeyId(event));
		return;
	}
	triggerInteraction(displayKey(event), keyName(event), event, {
		feedback: true,
	});
}

/**
 * A stable identifier for "this physical key" across a hold, for matching
 * a keyup back to the repeat that started growing it. `event.key` isn't
 * safe for that: it reflects the *current* modifier state, not the state
 * when the key went down, so holding Shift+A and releasing Shift before A
 * turns later repeats' `key` from "A" to "a" — and a keyup landing with
 * yet another modifier combination in effect could report a `key` that
 * never matches what growth actually started under, leaving the loop
 * running with nothing left to stop it. `event.code` reports the
 * physical key ("KeyA") regardless of modifiers, so it doesn't have this
 * problem; falling back to `key` covers callers that can't set `code`
 * (e.g. synthetic events in tests) — `code` defaults to `""` rather than
 * `undefined` when unset, so this has to be `||`, not `??`, or the empty
 * string would win and every key would collapse onto the same identifier.
 * @param {KeyboardEvent} event
 * @returns {string}
 */
function heldKeyId(event) {
	return event.code || event.key;
}

/**
 * Global keyup handler: ends the held-key growth effect once the key that
 * started it is actually released.
 * @param {KeyboardEvent} event
 */
export function releaseKey(event) {
	if (heldGrowth?.key === heldKeyId(event)) stopHeldKeyGrowth();
}

/** Time one growth cycle takes to reach the screen's edge. */
const HELD_KEY_GROW_MS = 1600;
/** How long the flash between one cycle ending and the next starting lasts. */
const HELD_KEY_POP_MS = 150;
/** The ring's opacity while actively growing (the pop flashes brighter). */
const HELD_KEY_RING_OPACITY = 0.8;

/**
 * The held-key growth effect currently running, if any: {@link heldKeyId}
 * of the key that started it, and the `requestAnimationFrame` id of its
 * next scheduled step (either phase — see {@link stepGrow}/{@link
 * stepPop} — uses the same field, so a single `cancelAnimationFrame`
 * always cancels whatever's pending).
 */
let heldGrowth = null;

/**
 * @returns {number} The `scale()` the ring needs to reach for its edge to
 * pass the farther edge of the screen from its center — "runs out of
 * screen" is the ring's natural cap, not an arbitrary fixed size, so it
 * scales with the device rather than looking tiny on a big monitor or
 * absurdly large on a phone.
 */
function ringScaleToFillScreen() {
	const rect = $("#keyOrb").getBoundingClientRect();
	const orbSize = Math.max(rect.width, rect.height) || 1;
	const reach = Math.max(window.innerWidth, window.innerHeight);
	return (reach / orbSize) * 1.2;
}

/**
 * Starts (or, if already running for this exact key, leaves alone) a
 * continuous growth effect around the key orb: a ring that widens for as
 * long as the key stays down, instead of every OS key-repeat re-running
 * the normal tap effects. A different key interrupting an existing effect
 * replaces it outright, since only one orb — and one ring around it —
 * exists on screen at a time.
 * @param {string} key {@link heldKeyId} of the key being held.
 */
function startHeldKeyGrowth(key) {
	if (heldGrowth?.key === key) return;
	cancelAnimationFrame(heldGrowth?.frameId);
	heldGrowth = { key, frameId: null };
	beginGrowPhase();
}

/** Resets the ring to invisible and starts a fresh growth cycle from it. */
function beginGrowPhase() {
	if (!heldGrowth) return;
	const ring = $("#heldKeyRing");
	ring.style.transition = "none";
	ring.style.opacity = "0";
	ring.style.transform = "scale(1)";
	// Computed once per cycle, not per frame: it's only ever needed at this
	// fixed number of points a hold could pass through it (roughly once a
	// second), and getBoundingClientRect() can force a layout — not
	// something to pay for on every animation frame.
	stepGrow(ring, performance.now(), ringScaleToFillScreen());
}

/**
 * One frame of the ring's growth toward the edge of the screen: sets its
 * size directly from elapsed time (no CSS transition — each frame is an
 * instant jump, so the ring never lags behind the key still being held).
 * Growth isn't unbounded: reaching the screen's edge ends the cycle in a
 * quick pop, rather than the ring either stopping dead or growing forever
 * past where anyone could still see it.
 * @param {HTMLElement} ring `#heldKeyRing`, looked up once in
 * {@link beginGrowPhase} and threaded through every frame — a querySelector
 * per frame would be wasted work on an element that never changes.
 * @param {number} startedAt `performance.now()` when this cycle began.
 * @param {number} targetScale This cycle's {@link ringScaleToFillScreen}
 * result, computed once in {@link beginGrowPhase} and threaded through
 * every frame rather than recomputed.
 */
function stepGrow(ring, startedAt, targetScale) {
	if (!heldGrowth) return;
	const progress = Math.min(
		1,
		(performance.now() - startedAt) / HELD_KEY_GROW_MS,
	);
	// Fades in over the first sixth of the cycle, then holds steady — so it's
	// already clearly visible well before it starts covering real ground.
	ring.style.opacity = String(
		Math.min(1, progress * 6) * HELD_KEY_RING_OPACITY,
	);
	ring.style.transform = `scale(${1 + progress * (targetScale - 1)})`;
	if (progress < 1) {
		heldGrowth.frameId = requestAnimationFrame(() =>
			stepGrow(ring, startedAt, targetScale),
		);
		return;
	}
	beginPopPhase();
}

/** Brightens the ring at its full, screen-filling size for a beat, marking the cycle's turnover before the next one begins. */
function beginPopPhase() {
	if (!heldGrowth) return;
	$("#heldKeyRing").style.opacity = "1";
	stepPop(performance.now());
}

/**
 * Holds the pop's flash for {@link HELD_KEY_POP_MS}, then loops back into
 * another growth cycle — for as long as the key is still held, this
 * repeats indefinitely instead of the ring ever just sitting maxed out.
 * @param {number} startedAt `performance.now()` when the pop began.
 */
function stepPop(startedAt) {
	if (!heldGrowth) return;
	if (performance.now() - startedAt < HELD_KEY_POP_MS) {
		heldGrowth.frameId = requestAnimationFrame(() => stepPop(startedAt));
		return;
	}
	beginGrowPhase();
}

/**
 * Ends any held-key growth effect: stops the frame loop (whichever phase
 * it was in) and lets the ring fade out from wherever it currently is,
 * instead of either snapping away instantly or (worse) being left to keep
 * animating after the key that drove it is gone. Also called defensively
 * whenever play stops or the window loses the context to ever see the
 * matching keyup (pause, session end, blur, the page going hidden).
 */
export function stopHeldKeyGrowth() {
	if (!heldGrowth) return;
	cancelAnimationFrame(heldGrowth.frameId);
	heldGrowth = null;
	const ring = $("#heldKeyRing");
	ring.style.transition = "opacity 0.4s ease";
	ring.style.opacity = "0";
}

/**
 * Registers one interaction and plays all of its feedback: starts a session
 * if needed, updates streaks (presses under 1.6 s apart chain) and per-key
 * counters, shows the key with a random encouragement phrase, fires the
 * visual effects, optionally plays a tone, and persists. Every interaction
 * — including Super Smash — goes through here, so stats, streak, and
 * persistence stay in one place instead of each caller tracking its own
 * subset of the bookkeeping.
 * @param {string} displayed Character shown on the orb and tracked in stats.
 * @param {string} label Text for the key-name line.
 * @param {{clientX?: number, clientY?: number}} point Effect origin for
 * pointer interactions; keyboard interactions use a random point instead.
 * @param {object} [options]
 * @param {boolean} [options.feedback=false] Discrete interaction (a keypress
 * or tap, not a mouse-trail move): plays a tone and/or vibrates, each still
 * independently gated by its own setting (`data.sound`, `data.vibration`).
 * @param {boolean} [options.pointer=false] Pointer interaction: draw a trail
 * at `point` and skip the sparkle/letter burst unless `burst` is set.
 * @param {boolean} [options.burst=false] Fire the sparkle/letter burst even
 * for a pointer interaction.
 * @param {boolean} [options.superSmash=false] A whole-hand slap: replaces
 * the usual sparkle/theme/letter effects with {@link makeSuperSmash}'s
 * screen-wide burst, and the usual single tone/buzz with a bigger pattern.
 */
export function triggerInteraction(
	displayed,
	label,
	point,
	{ feedback = false, pointer = false, burst = false, superSmash = false } = {},
) {
	if (!state.playing) startGame();
	resetIdleTimer();
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
	if (superSmash) {
		makeSuperSmash(effectPoint);
	} else {
		const points = kaleidoscopePoints(effectPoint);
		if (pointer)
			for (const kaleidoscopePoint of points)
				makePointerTrail(kaleidoscopePoint);
		if (!pointer || burst) {
			for (const kaleidoscopePoint of points) makeSparkles(kaleidoscopePoint);
			makeLetterTrail(displayed);
		}
		for (const kaleidoscopePoint of points)
			makeThemeMechanic(kaleidoscopePoint);
	}
	animateBackground();
	updateStreak();
	updateStats();
	if (feedback && data.sound) superSmash ? playSuperTone() : playTone();
	if (feedback && data.vibration)
		vibrate(superSmash ? SUPER_SMASH_PATTERN : 15);
	saveData();
}

/** Vibration pattern for Super Smash: five short, evenly-spaced pulses. */
const SUPER_SMASH_PATTERN = [40, 40, 40, 40, 40];

/**
 * Fires a short haptic pulse, or a custom pattern. A no-op wherever the
 * Vibration API doesn't exist (iOS Safari, most desktop browsers) or has no
 * hardware to act on.
 * @param {number | number[]} [pattern=15]
 */
function vibrate(pattern = 15) {
	navigator.vibrate?.(pattern);
}

/** Super Smash's bigger sound: three quick tones instead of one. */
function playSuperTone() {
	playTone();
	setTimeout(playTone, 80);
	setTimeout(playTone, 160);
}

/**
 * Points to fire a point-anchored effect at: just `point` when kaleidoscope
 * mode is off, otherwise `point` plus its mirror images across #playArea's
 * centre. Offsets are normalized to the play area's half-width/half-height
 * before the axis-swapping diagonal reflections, so on a wide screen every
 * mirrored point still lands inside the play area instead of past its top
 * or bottom edge. The reflection count scales down as {@link state.streak}
 * climbs (8 → 4 → 2) so a fast multi-key smash doesn't multiply an
 * already-fast pace of particles on top of itself — a single deliberate
 * press gets the full symmetry, and even mid-smash every burst keeps a
 * visible mirrored twin rather than the mode silently switching off.
 * @param {{clientX?: number, clientY?: number}} point
 * @returns {{clientX?: number, clientY?: number}[]}
 */
function kaleidoscopePoints(point) {
	if (
		!data.kaleidoscope ||
		!Number.isFinite(point.clientX) ||
		!Number.isFinite(point.clientY)
	)
		return [point];
	const reflections = state.streak >= 8 ? 2 : state.streak >= 4 ? 4 : 8;
	const rect = $("#playArea").getBoundingClientRect();
	// A zero-sized rect (mid-layout, hidden) would turn the normalized
	// offsets below into Infinity/NaN coordinates.
	if (rect.width <= 0 || rect.height <= 0) return [point];
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;
	const nx = (point.clientX - cx) / (rect.width / 2);
	const ny = (point.clientY - cy) / (rect.height / 2);
	const offsets =
		reflections === 2
			? [
					[nx, ny],
					[-nx, -ny],
				]
			: [
					[nx, ny],
					[-nx, ny],
					[nx, -ny],
					[-nx, -ny],
				];
	if (reflections === 8)
		offsets.push([ny, nx], [-ny, nx], [ny, -nx], [-ny, -nx]);
	return offsets.map(([ox, oy]) => ({
		clientX: cx + (ox * rect.width) / 2,
		clientY: cy + (oy * rect.height) / 2,
	}));
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

/** Simultaneous touches that trigger Super Smash instead of an ordinary tap. */
const SUPER_SMASH_TOUCH_THRESHOLD = 4;
/**
 * "Key" a Super Smash is tracked under in stats (favourite key, unique
 * keys). It isn't a real key, so it stays visually and semantically
 * distinct from any theme icon a normal tap might display.
 */
const SUPER_SMASH_KEY = "✋";

/**
 * How much of #playArea's edge, in CSS pixels, {@link data.edgeDeadZone}
 * ignores touches within, indexed by {@link data.edgeDeadZoneSize} (0 small,
 * 1 medium, 2 large). A toddler's grip is a physical width regardless of
 * screen size, so these are fixed pixel margins rather than percentages —
 * the same margin on a phone and a large tablet.
 */
const EDGE_DEAD_ZONE_MARGIN_PX = [16, 32, 48];

/**
 * @param {PointerEvent} event
 * @returns {boolean} Whether `event` landed within the edge dead zone.
 * Only meaningful when {@link data.edgeDeadZone} is on — callers gate on
 * that setting themselves, so this only ever does the (layout-forcing)
 * rect lookup when it might actually matter.
 */
function isInEdgeDeadZone(event) {
	const margin = EDGE_DEAD_ZONE_MARGIN_PX[data.edgeDeadZoneSize];
	const rect = $("#playArea").getBoundingClientRect();
	return (
		event.clientX - rect.left < margin ||
		rect.right - event.clientX < margin ||
		event.clientY - rect.top < margin ||
		rect.bottom - event.clientY < margin
	);
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

	// Filtering (and throttling) pointermove down to what could plausibly
	// matter *before* the dead-zone check below, rather than after, means
	// getBoundingClientRect() — which can force a layout — never runs on
	// the dozens of raw pointermove events a dragging mouse fires between
	// two throttled ones.
	const isMouseTrail =
		event.type === "pointermove" && event.pointerType === "mouse";
	if (event.type === "pointermove" && !isMouseTrail) return;
	const now = Date.now();
	if (isMouseTrail && now - state.lastPointerTime < 160) return;
	// Every event past this point is ours, whether or not the dead-zone
	// check below goes on to ignore it — otherwise a repeated tap sitting on
	// top of the orb's text falls through to the browser's own default
	// (selecting it, the way a rapid native double-click would), and nothing
	// in the app ever clears that selection.
	event.preventDefault();
	// Also advanced for an event the dead zone below goes on to ignore, not
	// just a registered one — otherwise a mouse trail along the edge never
	// re-arms this throttle, and getBoundingClientRect() in isInEdgeDeadZone
	// runs on every raw pointermove instead of one per 160 ms.
	state.lastPointerTime = now;
	// Excluded from Super Smash's count below too, not just an ordinary
	// tap: a toddler bracing the tablet with a whole hand along an edge is
	// gripping it, not slapping the play area.
	if (data.edgeDeadZone && isInEdgeDeadZone(event)) return;

	if (event.type === "pointerdown") {
		state.activePointers.add(event.pointerId);
		if (state.activePointers.size >= SUPER_SMASH_TOUCH_THRESHOLD) {
			state.activePointers.clear();
			// Goes through triggerInteraction like any other press — not a
			// direct makeSuperSmash() call — so the touch that crosses the
			// threshold still counts toward stats, streak, and persistence
			// instead of vanishing from them.
			triggerInteraction(SUPER_SMASH_KEY, SUPER_SMASH_KEY, event, {
				pointer: true,
				feedback: true,
				superSmash: true,
			});
			return;
		}
	}

	const icons = themeIcons[data.theme];
	const displayed = icons[Math.floor(Math.random() * icons.length)];
	triggerInteraction(displayed, displayed, event, {
		pointer: true,
		burst: event.type === "pointerdown",
		feedback: event.type === "pointerdown",
	});
}

/**
 * Removes a pointer from the active pointers set when it leaves the screen.
 * @param {PointerEvent} event
 */
export function releasePointer(event) {
	state.activePointers.delete(event.pointerId);
}
