import { playShakeSwoosh } from "./audio.js";
import { clearDoodle } from "./doodle.js";
import { clearEffects, createMagicBackground } from "./effects.js";
import { data, saveData } from "./state.js";

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

/** Whether this platform exposes DeviceMotion at all — most laptops, and some Android tablets, never fire it or lack the constructor entirely. */
function hasDeviceMotion() {
	return typeof window.DeviceMotionEvent !== "undefined";
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
	if (!hasDeviceMotion()) return false;
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

/**
 * Turns shake-to-clear off and forgets both the last reading and the last
 * trigger time, so a later re-enable starts clean — otherwise a quick
 * off/on still has the old cooldown live, and the first real shake right
 * after turning it back on can silently do nothing.
 */
export function disableShakeToClear() {
	window.removeEventListener("devicemotion", handleMotion);
	listening = false;
	lastReading = null;
	lastShakeAt = 0;
}

/**
 * Reconciles the persisted setting with what boot can actually do: attaches
 * the listener right away where no fresh permission prompt is needed, or —
 * on a platform with no DeviceMotion at all, or one like iOS that never
 * grants its permission outside a live gesture — turns the setting back off
 * and persists that, instead of leaving it checked but inert until the next
 * toggle. That's the same "checked but inert" state the denied-permission
 * path in the toggle's own change handler (main.js) already avoids; this is
 * boot's equivalent of it, checked synchronously so the correction is in
 * place before initializeApp()'s own updateShakeToClear() call reads it —
 * enableShakeToClear() resolves asynchronously even when nothing async
 * actually happens, which would otherwise leave the toggle showing the
 * stale, pre-correction value.
 */
export function initializeShakeToClear() {
	if (!data.shakeToClear) return;
	if (!hasDeviceMotion() || needsMotionPermission()) {
		data.shakeToClear = false;
		saveData();
		return;
	}
	enableShakeToClear();
}
