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
 * Plays a short synthesized tone through the Web Audio API. Waveform, pitch
 * range, pitch sweep, and length all derive from the current theme, giving
 * each theme its own sound character; every theme's pitch is snapped to the
 * nearest {@link PENTATONIC_SCALE} note, so a rapid smash across many keys
 * comes out sounding musical instead of random. Creates the shared
 * AudioContext on first call; failures are swallowed since sound is
 * optional.
 */
export function playTone() {
	try {
		audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		const now = audioContext.currentTime;
		oscillator.type = ["vehicles", "dinosaurs", "toys"].includes(data.theme)
			? "triangle"
			: data.theme === "lights"
				? "square"
				: "sine";
		oscillator.frequency.value =
			data.theme === "music"
				? PENTATONIC_OCTAVE[
						Math.floor(Math.random() * PENTATONIC_OCTAVE.length)
					]
				: data.theme === "bubbles"
					? nearestPentatonicNote(640 + Math.random() * 260)
					: data.theme === "dinosaurs"
						? nearestPentatonicNote(130 + Math.random() * 80)
						: data.theme === "farm"
							? nearestPentatonicNote(220 + Math.random() * 180)
							: data.theme === "weather"
								? nearestPentatonicNote(270 + Math.random() * 130)
								: data.theme === "bedtime"
									? nearestPentatonicNote(310 + Math.random() * 70)
									: data.theme === "space"
										? nearestPentatonicNote(430 + Math.random() * 250)
										: data.theme === "ocean"
											? nearestPentatonicNote(300 + Math.random() * 220)
											: nearestPentatonicNote(370 + Math.random() * 270);
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
		oscillator.connect(gain).connect(audioContext.destination);
		oscillator.start();
		oscillator.stop(now + (data.theme === "music" ? 0.37 : 0.23));
	} catch {
		/* Sound is optional; silently continue when unavailable. */
	}
}
