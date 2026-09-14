import { playShakeSwoosh } from "./audio.js";
import { clearDoodle } from "./doodle.js";
import { clearEffects, createMagicBackground } from "./effects.js";
import { data } from "./state.js";

/** Combined axis change, in m/s², past which a devicemotion reading counts as a shake. */
const SHAKE_THRESHOLD = 28;
/** Minimum gap between two triggers, so one shake fires once, not on every sample inside it. */
const SHAKE_COOLDOWN_MS = 1200;

let lastReading = null;
let lastShakeAt = 0;
let listening = false;

function handleMotion(event) {
	const acceleration = event.accelerationIncludingGravity;
	// Some devices (most laptops, some Android tablets) report the event
	// with every axis null instead of never firing it at all.
	if (!acceleration || acceleration.x === null) return;
	if (lastReading) {
		const delta =
			Math.abs(acceleration.x - lastReading.x) +
			Math.abs(acceleration.y - lastReading.y) +
			Math.abs(acceleration.z - lastReading.z);
		const now = Date.now();
		if (delta > SHAKE_THRESHOLD && now - lastShakeAt > SHAKE_COOLDOWN_MS) {
			lastShakeAt = now;
			createMagicBackground();
			clearEffects();
			clearDoodle();
			if (data.sound) playShakeSwoosh();
		}
	}
	lastReading = {
		x: acceleration.x,
		y: acceleration.y,
		z: acceleration.z,
	};
}

/** Whether this platform gates DeviceMotion behind an explicit, gesture-triggered grant (iOS 13+). */
function needsMotionPermission() {
	return typeof window.DeviceMotionEvent?.requestPermission === "function";
}

/**
 * Turns shake-to-clear on. On iOS this must run inside the settings
 * toggle's own change handler — a real user gesture — since
 * `requestPermission()` silently rejects when called any other way;
 * everywhere else DeviceMotion just works, no prompt involved.
 * @returns {Promise<boolean>} Whether the listener is actually active now.
 */
export async function enableShakeToClear() {
	if (typeof window.DeviceMotionEvent === "undefined") return false;
	if (needsMotionPermission()) {
		try {
			if ((await window.DeviceMotionEvent.requestPermission()) !== "granted")
				return false;
		} catch {
			return false;
		}
	}
	if (!listening) {
		window.addEventListener("devicemotion", handleMotion);
		listening = true;
	}
	return true;
}

/** Turns shake-to-clear off and forgets the last reading, so a later re-enable starts clean. */
export function disableShakeToClear() {
	window.removeEventListener("devicemotion", handleMotion);
	listening = false;
	lastReading = null;
}

/**
 * Re-arms shake-to-clear on boot if it was already on last session — but
 * only where that needs no fresh permission prompt. iOS never grants that
 * permission outside a live user gesture, so there a parent who left the
 * setting on has to toggle it once more to pass a new prompt; nothing here
 * can do that silently on page load.
 */
export function initializeShakeToClear() {
	if (data.shakeToClear && !needsMotionPermission()) enableShakeToClear();
}
