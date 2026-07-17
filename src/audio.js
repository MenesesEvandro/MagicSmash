import { data } from "./state.js";

let audioContext;

/**
 * Plays a short synthesized tone through the Web Audio API. Waveform, pitch
 * range, pitch sweep, and length all derive from the current theme, giving
 * each theme its own sound character. Creates the shared AudioContext on
 * first call; failures are swallowed since sound is optional.
 */
export function playTone() {
	try {
		audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		const now = audioContext.currentTime;
		const musicNotes = [261.63, 293.66, 329.63, 392, 440, 523.25];
		oscillator.type = ["vehicles", "dinosaurs", "toys"].includes(data.theme)
			? "triangle"
			: data.theme === "lights"
				? "square"
				: "sine";
		oscillator.frequency.value =
			data.theme === "music"
				? musicNotes[Math.floor(Math.random() * musicNotes.length)]
				: data.theme === "bubbles"
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
		if (data.theme === "vehicles")
			oscillator.frequency.exponentialRampToValueAtTime(230, now + 0.18);
		if (data.theme === "bubbles")
			oscillator.frequency.exponentialRampToValueAtTime(1020, now + 0.17);
		if (data.theme === "ocean")
			oscillator.frequency.exponentialRampToValueAtTime(190, now + 0.22);
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
