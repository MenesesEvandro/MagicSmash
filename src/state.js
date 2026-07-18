/** localStorage key under which {@link data} is persisted. */
export const storageKey = "magic-smash-data-v1";

/**
 * Default settings and lifetime stats. Serves as the base for {@link data}
 * and as the reset baseline for {@link resetStats}.
 */
export const initialData = {
	profile: "",
	language: "en",
	theme: "vehicles",
	colorMode: "light",
	duration: 5,
	sound: true,
	vibration: false,
	letterSize: 1,
	totalPresses: 0,
	totalSeconds: 0,
	keyCounts: {},
	uniqueKeys: [],
	bestSpeed: 0,
};

/**
 * @returns {object} The persisted object from localStorage, or an empty
 * object when nothing is stored, the JSON is unparsable, or storage access
 * itself throws.
 */
function loadData() {
	try {
		return JSON.parse(localStorage.getItem(storageKey)) || {};
	} catch {
		return {};
	}
}

/**
 * Persisted settings and lifetime stats: {@link initialData} overlaid with
 * whatever was last saved on this device. Mutated in place throughout the
 * app; only written back to storage when {@link saveData} runs.
 */
export let data = { ...initialData, ...loadData() };

/** In-memory state for the current session and its timers; never persisted. */
export const state = {
	playing: false,
	sessionPresses: 0,
	sessionKeys: new Set(),
	streak: 0,
	bestStreak: 0,
	lastKeyTime: 0,
	lastPointerTime: 0,
	startedAt: null,
	elapsedBeforePause: 0,
	paused: false,
	timerId: null,
	backgroundShuffleId: null,
};

/**
 * Persists {@link data} to localStorage. Write failures (full quota,
 * private browsing, blocked storage) are swallowed: this runs on every
 * keypress, and losing persistence beats throwing out of a hot path.
 */
export function saveData() {
	try {
		localStorage.setItem(storageKey, JSON.stringify(data));
	} catch {
		/* See above — losing persistence beats breaking play. */
	}
}

/**
 * Replaces {@link data} with a fresh copy of {@link initialData}, keeping
 * only the given fields.
 * @param {Partial<typeof initialData>} keep Fields to carry over.
 */
export function resetStats(keep) {
	data = { ...initialData, ...keep };
}
