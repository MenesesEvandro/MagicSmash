import { data } from "./state.js";

let audioContext;

/** The five pitch classes of C major pentatonic, rooted at C4 (C D E G A). */
const PENTATONIC_NOTES = [261.63, 293.66, 329.63, 392, 440];

/** The octave the Music theme picks from: {@link PENTATONIC_NOTES} plus the next C. */
const PENTATONIC_OCTAVE = [...PENTATONIC_NOTES, 523.25];

/** {@link PENTATONIC_NOTES} repeated across enough octaves to cover every theme's frequency range below. */
const PENTATONIC_SCALE = [-2, -1, 0, 1, 2].flatMap((octave) =>
	PENTATONIC_NOTES.map((note) => note * 2 ** octave),
);

/**
 * @param {number} frequency
 * @returns {number} The note in {@link PENTATONIC_SCALE} closest to `frequency`.
 */
function nearestPentatonicNote(frequency) {
	return PENTATONIC_SCALE.reduce((closest, note) =>
		Math.abs(note - frequency) < Math.abs(closest - frequency) ? note : closest,
	);
}

/**
 * One fixed colour per {@link PENTATONIC_NOTES} pitch class (C D E G A), for
 * {@link data.noteColors} — always the same note, always the same colour,
 * regardless of theme or octave.
 */
export const NOTE_COLORS = [
	"#e2503a",
	"#e0872e",
	"#d4b02a",
	"#4a9e5c",
	"#3d84c6",
];

/**
 * Picks the note this interaction's tone will play: an absolute frequency
 * that's always one of the app's pentatonic notes (the frequency range
 * comes from the current theme, same as always) — snapped to
 * {@link PENTATONIC_SCALE} via {@link nearestPentatonicNote} for every
 * theme except Music, which instead picks straight from
 * {@link PENTATONIC_OCTAVE} — plus that note's pitch class, an index into
 * {@link PENTATONIC_NOTES} and {@link NOTE_COLORS} alike, independent of
 * which octave it landed in. Split out from playTone() so a note can be
 * picked (and, once {@link data.noteColors} exists, coloured) without
 * needing the Web Audio API to actually be available.
 * @returns {{frequency: number, noteIndex: number}}
 */
function pickNote() {
	if (data.theme === "music") {
		const octaveIndex = Math.floor(Math.random() * PENTATONIC_OCTAVE.length);
		return {
			frequency: PENTATONIC_OCTAVE[octaveIndex],
			noteIndex: octaveIndex % PENTATONIC_NOTES.length,
		};
	}
	const target =
		data.theme === "bubbles"
			? 640 + Math.random() * 260
			: data.theme === "dinosaurs"
				? 130 + Math.random() * 80
				: data.theme === "farm"
					? 220 + Math.random() * 180
					: data.theme === "weather"
						? 270 + Math.random() * 130
						: data.theme === "bedtime"
							? 310 + Math.random() * 70
							: data.theme === "space"
								? 430 + Math.random() * 250
								: data.theme === "ocean"
									? 300 + Math.random() * 220
									: 370 + Math.random() * 270;
	const frequency = nearestPentatonicNote(target);
	return {
		frequency,
		noteIndex: PENTATONIC_SCALE.indexOf(frequency) % PENTATONIC_NOTES.length,
	};
}

/**
 * Plays a short synthesized tone through the Web Audio API. Waveform, pitch
 * range, pitch sweep, and length all derive from the current theme, giving
 * each theme its own sound character; every theme's pitch is snapped to the
 * nearest {@link PENTATONIC_SCALE} note, so a rapid smash across many keys
 * comes out sounding musical instead of random. Creates the shared
 * AudioContext on first call; failures are swallowed since sound is
 * optional — but the note is picked before that call, so the returned index
 * is still meaningful even when audio itself isn't available.
 * @param {number} [pan=0] Stereo position, -1 (left) to 1 (right) — where on
 * screen the interaction happened, defaulting to 0 (centred) for keyboard
 * input, which has no natural on-screen position of its own.
 * @returns {number} The played note's pitch class — see {@link pickNote}.
 */
export function playTone(pan = 0) {
	const { frequency, noteIndex } = pickNote();
	try {
		audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		// Some older engines (notably early iOS Safari) never shipped
		// StereoPannerNode; falling back to a second, otherwise-untouched
		// GainNode keeps it a harmless pass-through so a tap still makes
		// sound there, just centred, instead of createStereoPanner() itself
		// throwing and the catch below silently dropping the tone entirely.
		const supportsPanning =
			typeof audioContext.createStereoPanner === "function";
		const panner = supportsPanning
			? audioContext.createStereoPanner()
			: audioContext.createGain();
		if (supportsPanning) panner.pan.value = Math.min(1, Math.max(-1, pan));
		const now = audioContext.currentTime;
		oscillator.type = [
			"vehicles",
			"dinosaurs",
			"toys",
			"construction",
		].includes(data.theme)
			? "triangle"
			: ["lights", "robots"].includes(data.theme)
				? "square"
				: "sine";
		oscillator.frequency.value = frequency;
		if (data.theme === "vehicles")
			oscillator.frequency.exponentialRampToValueAtTime(
				nearestPentatonicNote(230),
				now + 0.18,
			);
		if (data.theme === "bubbles")
			oscillator.frequency.exponentialRampToValueAtTime(
				nearestPentatonicNote(1020),
				now + 0.17,
			);
		if (data.theme === "ocean")
			oscillator.frequency.exponentialRampToValueAtTime(
				nearestPentatonicNote(190),
				now + 0.22,
			);
		gain.gain.setValueAtTime(0.04, now);
		gain.gain.exponentialRampToValueAtTime(
			0.001,
			now + (data.theme === "music" ? 0.36 : 0.22),
		);
		oscillator.connect(gain).connect(panner).connect(audioContext.destination);
		oscillator.start();
		oscillator.stop(now + (data.theme === "music" ? 0.37 : 0.23));
	} catch {
		/* Sound is optional; silently continue when unavailable. */
	}
	return noteIndex;
}
