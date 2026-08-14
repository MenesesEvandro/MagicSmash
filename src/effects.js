import { $, $$ } from "./dom.js";
import { data, state } from "./state.js";
import { themeIcons } from "./themes.js";

const BACKGROUND_SHUFFLE_INTERVAL_MS = 30000;
/** Chance in [0, 1] of a theme effect getting a contrast backdrop; 0 disables backdrops. */
const THEME_EFFECT_BACKDROP_PROBABILITY = 0;
/** Feature flag for the background icon growth reaction in {@link animateBackground}. */
const BACKGROUND_ICON_GROWTH_ON_KEYPRESS = true;

function shouldUseThemeEffectBackdrop() {
	return (
		THEME_EFFECT_BACKDROP_PROBABILITY > 0 &&
		Math.random() < THEME_EFFECT_BACKDROP_PROBABILITY
	);
}

/**
 * Rebuilds the floating background icons in #magicLayer for the current
 * theme: 15 icons for themes with visually large symbols, 20 smaller ones
 * otherwise, each with randomized position, size, tint, and float timing.
 */
export function createMagicBackground() {
	const layer = $("#magicLayer");
	const icons = themeIcons[data.theme];
	const colours = [
		"rgba(255,255,255,.86)",
		"var(--accent)",
		"var(--orb-c)",
		"rgba(255,255,255,.67)",
	];
	layer.replaceChildren();
	const largeObjects = [
		"vehicles",
		"bubbles",
		"music",
		"party",
		"space",
		"beach",
		"ocean",
		"toys",
		"construction",
	].includes(data.theme);
	for (let index = 0; index < (largeObjects ? 15 : 20); index++) {
		const object = document.createElement("span");
		object.className = "magic-object";
		object.textContent = icons[index % icons.length];
		object.style.setProperty("--left", `${4 + Math.random() * 92}%`);
		object.style.setProperty("--top", `${7 + Math.random() * 86}%`);
		object.style.setProperty(
			"--size",
			`${largeObjects ? 44 + Math.random() * 44 : 24 + Math.random() * 44}px`,
		);
		object.style.setProperty("--delay", `${-Math.random() * 8}s`);
		object.style.setProperty("--float-duration", `${4 + Math.random() * 5}s`);
		object.style.setProperty("--object-color", colours[index % colours.length]);
		layer.append(object);
	}
}

/**
 * Restarts the interval that rebuilds the background every 30 seconds,
 * clearing any previous one so only a single shuffle timer ever runs.
 */
export function startBackgroundShuffle() {
	clearInterval(state.backgroundShuffleId);
	state.backgroundShuffleId = window.setInterval(
		createMagicBackground,
		BACKGROUND_SHUFFLE_INTERVAL_MS,
	);
}

/**
 * Replays a grow animation on up to five random background icons. Gated by
 * {@link BACKGROUND_ICON_GROWTH_ON_KEYPRESS}.
 */
export function animateBackground() {
	if (!BACKGROUND_ICON_GROWTH_ON_KEYPRESS) return;
	const objects = $$(".magic-object");
	for (const object of objects.sort(() => Math.random() - 0.5).slice(0, 5)) {
		object.classList.remove("pop-grow");
		void object.offsetWidth;
		object.classList.add("pop-grow");
		object.addEventListener(
			"animationend",
			() => object.classList.remove("pop-grow"),
			{ once: true },
		);
	}
}

/**
 * How long without input before the background livens up on its own. On
 * the shorter side of what the idea sketch suggested (30–60s): for a
 * one-to-two-year-old's attention span, a half-minute of a static screen
 * risks the moment to re-catch their eye having already passed.
 */
const IDLE_TIMEOUT_MS = 10000;
/** How often {@link animateBackground} fires on its own while idle. */
const IDLE_TICK_MS = 1500;

/** The pending "go idle" timeout, if any. */
let idleTimerId = null;
/** The recurring animateBackground() driver while idle, if currently idle. */
let idleTickerId = null;

/**
 * @returns {boolean} Whether the visitor asked the OS for less motion. Gates
 * two things: attract mode, which is *deliberately* attention-grabbing
 * movement that starts on its own with nobody having touched anything —
 * exactly what this preference exists to opt out of — and, via
 * {@link particleCount}, how many particles a single effect spawns. The
 * stylesheet's global reduced-motion rule already flattens every
 * animation's duration; neither of those touches how much stuff appears at
 * once, which is what these two cover instead.
 */
function prefersReducedMotion() {
	return (
		window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
	);
}

/**
 * @param {number} base Normal particle count for an effect.
 * @returns {number} `base`, or roughly half of it (never below 1) under
 * {@link prefersReducedMotion} — fewer things flashing into existence at
 * once for a child sensitive to visual clutter, since flattened animation
 * durations alone still leave every particle appearing (just instantly).
 */
function particleCount(base) {
	return prefersReducedMotion() ? Math.max(1, Math.round(base / 2)) : base;
}

/**
 * Speeds up the ambient drift (see the `body.idle` rule in styles.css) and
 * starts nudging it with {@link animateBackground} every {@link
 * IDLE_TICK_MS} — a toddler who wandered off, or just paused to stare,
 * still sees something happening on its own instead of a static screen.
 */
function enterIdle() {
	state.idle = true;
	document.body.classList.add("idle");
	idleTickerId = window.setInterval(animateBackground, IDLE_TICK_MS);
}

/** Drops back to the normal, quieter ambient drift. */
function exitIdle() {
	state.idle = false;
	document.body.classList.remove("idle");
	clearInterval(idleTickerId);
	idleTickerId = null;
}

/**
 * Rearms the idle countdown from a real interaction — call on every
 * keypress and pointer interaction. Pops the background back to its normal
 * pace immediately if it had already gone idle, the same way any input
 * would. A no-op outside active, unpaused play: there's nothing to idle
 * out of on the welcome screen or with the settings/stats panel open, so
 * no countdown is armed in either case.
 */
export function resetIdleTimer() {
	clearTimeout(idleTimerId);
	idleTimerId = null;
	if (state.idle) exitIdle();
	if (!state.playing || state.paused || prefersReducedMotion()) return;
	idleTimerId = window.setTimeout(enterIdle, IDLE_TIMEOUT_MS);
}

/**
 * Fully stops any idle countdown or state — call whenever play stops being
 * active (paused, ended) so the background doesn't keep counting down, or
 * stay livened up, behind the scenes.
 */
export function stopIdleTimer() {
	clearTimeout(idleTimerId);
	idleTimerId = null;
	exitIdle();
}

/**
 * Bursts five theme icons (or fewer — see {@link particleCount}) outward
 * from the given point, or from the key orb's center when the point has no
 * finite coordinates. Each spark removes itself when its animation ends.
 * @param {{clientX?: number, clientY?: number}} event Pointer event or point-like object.
 */
export function makeSparkles(event) {
	const rect = $("#keyOrb").getBoundingClientRect();
	const x = Number.isFinite(event.clientX)
		? event.clientX
		: rect.left + rect.width / 2;
	const y = Number.isFinite(event.clientY)
		? event.clientY
		: rect.top + rect.height / 2;
	const icons = themeIcons[data.theme];
	for (let i = 0; i < particleCount(5); i++) {
		const spark = document.createElement("span");
		spark.className = "spark";
		spark.textContent = icons[Math.floor(Math.random() * icons.length)];
		spark.style.setProperty("--x", `${x}px`);
		spark.style.setProperty("--y", `${y}px`);
		spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 230}px`);
		spark.style.setProperty("--dy", `${(Math.random() - 0.5) * 230}px`);
		$("#sparkles").append(spark);
		spark.addEventListener("animationend", () => spark.remove());
	}
}

/**
 * Bigger-for-slower, smaller-for-faster is intentional, not inverted by
 * mistake — think of it as painting rather than impact: a slow, lazy drag
 * lays down a big unhurried blob, the way slowly dragging a wet brush
 * pools more paint, while a fast flick barely touches the surface and
 * leaves a thin streak that's already fading. Not "a bigger hit for a
 * bigger swing."
 */

/** Drag speed (px/ms) at or below which a trail spark renders at its
 * biggest, slowest-fading size; see {@link makePointerTrail}. */
const TRAIL_SPEED_SLOW = 0.05;
/** Drag speed (px/ms) at or above which a trail spark renders at its
 * smallest, quickest-fading size; see {@link makePointerTrail}. */
const TRAIL_SPEED_FAST = 1.2;
/** Font-size multiplier (applied to the existing responsive clamp) at
 * {@link TRAIL_SPEED_SLOW} and below. */
const TRAIL_SCALE_SLOW = 1.6;
/** Font-size multiplier at {@link TRAIL_SPEED_FAST} and above. */
const TRAIL_SCALE_FAST = 0.65;
/** Animation duration, in seconds, at {@link TRAIL_SPEED_SLOW} and below. */
const TRAIL_DURATION_SLOW_S = 0.9;
/** Animation duration, in seconds, at {@link TRAIL_SPEED_FAST} and above. */
const TRAIL_DURATION_FAST_S = 0.45;

/**
 * Leaves a single theme icon drifting upward from the given point (key orb
 * center when coordinates are missing); it removes itself after animating.
 * @param {{clientX?: number, clientY?: number}} event Pointer event or point-like object.
 * @param {number} [dragSpeed] Pixels per millisecond the drag that
 * triggered this was moving at, if any — a slow drag (at or below
 * {@link TRAIL_SPEED_SLOW}) renders a big, lingering spark, a fast one (at
 * or above {@link TRAIL_SPEED_FAST}) a small, quick one, linearly
 * interpolated in between. Left at the CSS defaults (matching every spark
 * before this existed) when omitted — a tap's own incidental spark, say,
 * has no drag to measure a speed from.
 */
export function makePointerTrail(event, dragSpeed) {
	const trail = document.createElement("span");
	const rect = $("#keyOrb").getBoundingClientRect();
	const x = Number.isFinite(event.clientX)
		? event.clientX
		: rect.left + rect.width / 2;
	const y = Number.isFinite(event.clientY)
		? event.clientY
		: rect.top + rect.height / 2;
	trail.className = "pointer-trail";
	trail.textContent =
		themeIcons[data.theme][
			Math.floor(Math.random() * themeIcons[data.theme].length)
		];
	trail.style.setProperty("--x", `${x}px`);
	trail.style.setProperty("--y", `${y}px`);
	trail.style.setProperty("--dx", `${(Math.random() - 0.5) * 80}px`);
	trail.style.setProperty("--dy", `${-30 - Math.random() * 70}px`);
	if (Number.isFinite(dragSpeed)) {
		const clamped = Math.min(
			TRAIL_SPEED_FAST,
			Math.max(TRAIL_SPEED_SLOW, dragSpeed),
		);
		const fraction =
			(clamped - TRAIL_SPEED_SLOW) / (TRAIL_SPEED_FAST - TRAIL_SPEED_SLOW);
		trail.style.setProperty(
			"--trail-scale",
			`${TRAIL_SCALE_SLOW + fraction * (TRAIL_SCALE_FAST - TRAIL_SCALE_SLOW)}`,
		);
		trail.style.setProperty(
			"--trail-duration",
			`${TRAIL_DURATION_SLOW_S + fraction * (TRAIL_DURATION_FAST_S - TRAIL_DURATION_SLOW_S)}s`,
		);
	}
	$("#sparkles").append(trail);
	trail.addEventListener("animationend", () => trail.remove());
}

/**
 * Fires the current theme's signature effect: a vehicle driving across the
 * screen at the press's height for `vehicles`, otherwise a handful of theme
 * symbols rising from around the given point (key orb center when
 * coordinates are missing).
 * No-op for a theme id missing from {@link themeIcons}.
 * @param {{clientX?: number, clientY?: number}} event Pointer event or point-like object.
 */
export function makeThemeMechanic(event) {
	// Every theme has a mechanic below, so this only guards against a theme
	// that doesn't exist in themeIcons at all — no separate list to keep in
	// sync with themes.js when a theme is added, renamed, or removed.
	if (!themeIcons[data.theme]) return;
	const effects = $("#themeEffects");
	const rect = $("#keyOrb").getBoundingClientRect();
	const x = Number.isFinite(event.clientX)
		? event.clientX
		: rect.left + rect.width / 2;
	const y = Number.isFinite(event.clientY)
		? event.clientY
		: rect.top + rect.height / 2;

	if (data.theme === "vehicles") {
		const vehicle = document.createElement("span");
		vehicle.className = "theme-effect vehicle-effect";
		if (shouldUseThemeEffectBackdrop()) vehicle.classList.add("with-backdrop");
		vehicle.textContent =
			themeIcons.vehicles[
				Math.floor(Math.random() * themeIcons.vehicles.length)
			];
		// Drive across at the height of the press (clamped to the original
		// 12–84% band) rather than a random lane, so the effect answers the
		// touch's position — and so kaleidoscope mode's mirrored points show
		// up as a symmetric fleet instead of being ignored. --y resolves
		// against .theme-effects, which fills #playArea — taller than the
		// viewport and possibly scrolled — so the percentage has to come from
		// the play area's own rect, not window.innerHeight.
		const areaRect = $("#playArea").getBoundingClientRect();
		const lane = Math.min(
			84,
			Math.max(12, ((y - areaRect.top) / Math.max(1, areaRect.height)) * 100),
		);
		vehicle.style.setProperty("--y", `${lane}%`);
		effects.append(vehicle);
		vehicle.addEventListener("animationend", () => vehicle.remove());
		return;
	}

	if (
		[
			"colors",
			"weather",
			"dinosaurs",
			"farm",
			"party",
			"space",
			"beach",
			"ocean",
			"lights",
			"toys",
			"bedtime",
			"safari",
			"robots",
			"garden",
			"seasons",
			"construction",
			"fantasy",
			"polar",
		].includes(data.theme)
	) {
		const effectCount = particleCount(
			["colors", "party"].includes(data.theme)
				? 6
				: data.theme === "lights"
					? 4
					: 3,
		);
		const className = {
			colors: "color-effect",
			weather: "weather-effect",
			dinosaurs: "dinosaur-effect",
			farm: "farm-effect",
			party: "party-effect",
			space: "space-effect",
			beach: "beach-effect",
			ocean: "ocean-effect",
			lights: "lights-effect",
			toys: "toys-effect",
			bedtime: "bedtime-effect",
			safari: "safari-effect",
			robots: "robots-effect",
			garden: "garden-effect",
			seasons: "seasons-effect",
			construction: "construction-effect",
			fantasy: "fantasy-effect",
			polar: "polar-effect",
		}[data.theme];
		const symbols = {
			colors: ["🔴", "🟡", "🟢", "🔵", "🟣", "✨"],
			weather: themeIcons.weather,
			dinosaurs: ["👣", "🦕", "🌋"],
			farm: themeIcons.farm,
			party: themeIcons.party,
			space: themeIcons.space,
			beach: themeIcons.beach,
			ocean: themeIcons.ocean,
			lights: themeIcons.lights,
			toys: themeIcons.toys,
			bedtime: themeIcons.bedtime,
			safari: themeIcons.safari,
			robots: themeIcons.robots,
			garden: themeIcons.garden,
			seasons: themeIcons.seasons,
			construction: themeIcons.construction,
			fantasy: themeIcons.fantasy,
			polar: themeIcons.polar,
		}[data.theme];
		for (let index = 0; index < effectCount; index++) {
			const effect = document.createElement("span");
			effect.className = `theme-effect ${className}`;
			if (shouldUseThemeEffectBackdrop()) effect.classList.add("with-backdrop");
			effect.textContent = symbols[Math.floor(Math.random() * symbols.length)];
			effect.style.setProperty("--x", `${x + (Math.random() - 0.5) * 145}px`);
			effect.style.setProperty("--y", `${y + (Math.random() - 0.5) * 80}px`);
			effect.style.setProperty("--dx", `${(Math.random() - 0.5) * 180}px`);
			effect.style.setProperty("--dy", `${-40 - Math.random() * 150}px`);
			effects.append(effect);
			effect.addEventListener("animationend", () => effect.remove());
		}
		return;
	}

	const effectsPerTouch = particleCount(data.theme === "bubbles" ? 4 : 3);
	for (let index = 0; index < effectsPerTouch; index++) {
		const effect = document.createElement("span");
		effect.className = `theme-effect ${data.theme === "bubbles" ? "bubble-effect" : "music-effect"}`;
		if (shouldUseThemeEffectBackdrop()) effect.classList.add("with-backdrop");
		effect.textContent =
			data.theme === "bubbles" ? "🫧" : ["♫", "♪", "♬"][index];
		effect.style.setProperty("--x", `${x + (Math.random() - 0.5) * 110}px`);
		effect.style.setProperty("--y", `${y + (Math.random() - 0.5) * 65}px`);
		effect.style.setProperty("--dx", `${(Math.random() - 0.5) * 155}px`);
		effect.style.setProperty("--dy", `${-45 - Math.random() * 125}px`);
		effects.append(effect);
		effect.addEventListener("animationend", () => effect.remove());
	}
}

/**
 * Scatters nine copies (or fewer — see {@link particleCount}) of the
 * pressed character across the play area, each popping away and removing
 * itself when its animation ends.
 * @param {string} letter Character to display.
 */
export function makeLetterTrail(letter) {
	const layer = $("#magicLayer");
	for (let index = 0; index < particleCount(9); index++) {
		const pop = document.createElement("span");
		pop.className = "letter-pop";
		pop.textContent = letter;
		pop.style.setProperty("--left", `${12 + Math.random() * 76}%`);
		pop.style.setProperty("--top", `${20 + Math.random() * 61}%`);
		pop.style.setProperty("--size", `${28 + Math.random() * 52}px`);
		pop.style.setProperty("--dx", `${(Math.random() - 0.5) * 330}px`);
		pop.style.setProperty("--dy", `${(Math.random() - 0.5) * 260}px`);
		pop.style.setProperty("--turn", `${-35 + Math.random() * 70}deg`);
		layer.append(pop);
		pop.addEventListener("animationend", () => pop.remove());
	}
}

/**
 * Creates a massive screen-wide burst of particles (or fewer — see
 * {@link particleCount}) and a giant central emoji for a whole-hand slap.
 * Purely visual, like every other effect in this module — the game decides
 * whether and how a Super Smash sounds or vibrates, the same way it does
 * for every other interaction.
 * @param {{clientX?: number, clientY?: number}} event Pointer event or point-like object.
 */
export function makeSuperSmash(event) {
	const rect = $("#playArea").getBoundingClientRect();
	const x = Number.isFinite(event.clientX)
		? event.clientX
		: rect.left + rect.width / 2;
	const y = Number.isFinite(event.clientY)
		? event.clientY
		: rect.top + rect.height / 2;

	const icons = themeIcons[data.theme];

	for (let i = 0; i < particleCount(40); i++) {
		const spark = document.createElement("span");
		spark.className = "spark super-spark";
		spark.textContent = icons[Math.floor(Math.random() * icons.length)];
		spark.style.setProperty("--x", `${x}px`);
		spark.style.setProperty("--y", `${y}px`);
		spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 800}px`);
		spark.style.setProperty("--dy", `${(Math.random() - 0.5) * 800}px`);
		$("#sparkles").append(spark);
		spark.addEventListener("animationend", () => spark.remove());
	}

	const superEmoji = document.createElement("span");
	superEmoji.className = "super-smash-emoji";
	superEmoji.textContent = icons[Math.floor(Math.random() * icons.length)];
	superEmoji.style.setProperty("--x", `${x}px`);
	superEmoji.style.setProperty("--y", `${y}px`);
	$("#themeEffects").append(superEmoji);
	superEmoji.addEventListener("animationend", () => superEmoji.remove());
}
