export const storageKey = "magic-smash-data-v1";
export const initialData = {
	profile: "",
	language: "en",
	theme: "vehicles",
	colorMode: "light",
	duration: 5,
	sound: true,
	letterSize: 1,
	totalPresses: 0,
	totalSeconds: 0,
	keyCounts: {},
	uniqueKeys: [],
	bestSpeed: 0,
};

function loadData() {
	try {
		return JSON.parse(localStorage.getItem(storageKey)) || {};
	} catch {
		return {};
	}
}

export let data = { ...initialData, ...loadData() };
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
	timerId: null,
	backgroundShuffleId: null,
};

export function saveData() {
	try {
		localStorage.setItem(storageKey, JSON.stringify(data));
	} catch {
		// Storage can be full or blocked (private browsing, quota, an
		// extension). Losing persistence for this session beats throwing out
		// of a hot path like every keypress.
	}
}

export function resetStats(keep) {
	data = { ...initialData, ...keep };
}
