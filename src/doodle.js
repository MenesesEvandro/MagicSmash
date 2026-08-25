import { $ } from "./dom.js";
import { data, state } from "./state.js";

const DOODLE_CLEAR_AFTER_MS = 12000;
const DOODLE_COLORS = ["#f75b82", "#ffae35", "#42bce5", "#8969e8", "#61c979"];

let context = null;
let clearTimerId = null;
const strokes = new Map();

function canvas() {
	return /** @type {HTMLCanvasElement} */ ($("#doodleCanvas"));
}

/** Sizes the canvas for its CSS box while keeping lines crisp on retina displays. */
export function resizeDoodle() {
	const element = canvas();
	const area = $("#playArea");
	if (!element || !area) return;
	const rect = area.getBoundingClientRect();
	const scale = window.devicePixelRatio || 1;
	element.width = Math.max(1, Math.round(rect.width * scale));
	element.height = Math.max(1, Math.round(rect.height * scale));
	// jsdom intentionally exposes the canvas element without a 2D renderer.
	// Treat that the same as an older browser with no drawing support, so the
	// rest of the game remains testable and usable.
	if (!window.CanvasRenderingContext2D) {
		context = null;
		return;
	}
	context = element.getContext("2d");
	context?.setTransform(scale, 0, 0, scale, 0, 0);
	clearDoodle();
}

/** Prepares the drawing surface once the page's DOM is available. */
export function initializeDoodle() {
	resizeDoodle();
	window.addEventListener("resize", resizeDoodle, { passive: true });
}

/** Removes every visible mark and forgets any in-progress strokes. */
export function clearDoodle() {
	clearTimeout(clearTimerId);
	clearTimerId = null;
	strokes.clear();
	const element = canvas();
	if (!context || !element) return;
	context.clearRect(0, 0, element.width, element.height);
}

function scheduleClear() {
	clearTimeout(clearTimerId);
	clearTimerId = window.setTimeout(clearDoodle, DOODLE_CLEAR_AFTER_MS);
}

function pointInCanvas(event, rect = $("#playArea").getBoundingClientRect()) {
	return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function brushWidth(event) {
	return event.pointerType === "touch" ? 28 : 18;
}

function colorFor(pointerId) {
	return DOODLE_COLORS[Math.abs(Number(pointerId) || 0) % DOODLE_COLORS.length];
}

/** Starts a bright round brush mark at a valid pointer-down point. */
export function beginDoodleStroke(event) {
	if (!data.doodleMode || !state.playing || !context) return;
	const point = pointInCanvas(event);
	const color = colorFor(event.pointerId);
	const width = brushWidth(event);
	strokes.set(event.pointerId, { ...point, color, width });
	context.save();
	context.fillStyle = color;
	context.shadowColor = color;
	context.shadowBlur = 8;
	context.beginPath();
	context.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
	context.fill();
	context.restore();
	scheduleClear();
}

/** Extends an active finger or pressed mouse stroke without throttling it. */
export function continueDoodleStroke(
	event,
	rect = $("#playArea").getBoundingClientRect(),
) {
	const stroke = strokes.get(event.pointerId);
	if (!data.doodleMode || !state.playing || !context || !stroke) return;
	if (event.pointerType === "mouse" && event.buttons !== 1) return;
	const point = pointInCanvas(event, rect);
	context.save();
	context.strokeStyle = stroke.color;
	context.lineWidth = stroke.width;
	context.lineCap = "round";
	context.lineJoin = "round";
	context.shadowColor = stroke.color;
	context.shadowBlur = 8;
	context.beginPath();
	context.moveTo(stroke.x, stroke.y);
	context.lineTo(point.x, point.y);
	context.stroke();
	context.restore();
	strokes.set(event.pointerId, { ...stroke, ...point });
	scheduleClear();
}

/** Completes the stroke tracked for one pointer. */
export function endDoodleStroke(pointerId) {
	strokes.delete(pointerId);
}
