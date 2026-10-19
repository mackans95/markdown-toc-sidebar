// The handle on the sidebar's inner edge that changes its width, by dragging or with the arrow keys.
import { readStored, writeStored } from '../storage.ts';
import { sidebarPosition } from './config.ts';
import { keepDoubleClickInside, NAV_ID, RESIZER_ID } from './dom.ts';

const WIDTH_KEY = 'md-toc-sidebar.width';
const MIN_WIDTH = 140;
// Always leave at least this much room for the document itself.
const MIN_CONTENT_WIDTH = 240;
const KEYBOARD_STEP = 16;

function readWidth(): number | undefined {
	const width = Number(readStored(WIDTH_KEY));
	return width > 0 ? width : undefined;
}

function writeWidth(width: number | undefined) {
	writeStored(WIDTH_KEY, width === undefined ? undefined : String(Math.round(width)));
}

// Width of the area fixed elements are laid out in: excludes the preview's own scrollbar.
function viewportWidth() {
	return document.documentElement.clientWidth;
}

function clampWidth(width: number) {
	const max = Math.max(MIN_WIDTH, viewportWidth() - MIN_CONTENT_WIDTH);
	return Math.min(Math.max(width, MIN_WIDTH), max);
}

// A user-chosen width overrides the responsive default from toc.css; undefined restores it.
// The stored value is kept unclamped so a narrow window doesn't permanently shrink it.
function applyWidth(width: number | undefined) {
	const root = document.documentElement;
	if (width === undefined) {
		root.style.removeProperty('--md-toc-width');
	} else {
		root.style.setProperty('--md-toc-width', clampWidth(width) + 'px');
	}
	updateResizerValue();
}

export function updateResizerValue(): void {
	const resizer = document.getElementById(RESIZER_ID);
	const nav = document.getElementById(NAV_ID);
	if (resizer && nav) {
		resizer.setAttribute('aria-valuenow', String(Math.round(nav.getBoundingClientRect().width)));
	}
}

export function initResizer(): void {
	const resizer = document.createElement('div');
	resizer.id = RESIZER_ID;
	resizer.tabIndex = 0;
	resizer.setAttribute('role', 'separator');
	resizer.setAttribute('aria-orientation', 'vertical');
	resizer.setAttribute('aria-controls', NAV_ID);
	resizer.setAttribute('aria-label', 'Resize table of contents');
	resizer.setAttribute('aria-valuemin', String(MIN_WIDTH));
	resizer.title = 'Drag to resize, double-click to reset';
	keepDoubleClickInside(resizer);
	document.body.appendChild(resizer);

	// The nav is created on the first build, which runs before any input reaches the resizer.
	const currentWidth = () => document.getElementById(NAV_ID)!.getBoundingClientRect().width;
	let dragWidth: number | undefined;

	resizer.addEventListener('pointerdown', event => {
		if (event.button !== 0) {
			return;
		}
		// No preventDefault here: it would also suppress the dblclick used to reset the width.
		// Text selection during the drag is prevented by the md-toc-resizing class instead.
		resizer.setPointerCapture(event.pointerId);
		document.body.classList.add('md-toc-resizing');
		dragWidth = currentWidth();
	});

	resizer.addEventListener('pointermove', event => {
		if (!resizer.hasPointerCapture(event.pointerId)) {
			return;
		}
		// The sidebar is pinned to one edge, so its width is the pointer's distance from that edge.
		const distance = sidebarPosition() === 'left' ? event.clientX : viewportWidth() - event.clientX;
		dragWidth = clampWidth(distance);
		applyWidth(dragWidth);
	});

	const endDrag = (event: PointerEvent) => {
		if (!resizer.hasPointerCapture(event.pointerId)) {
			return;
		}
		resizer.releasePointerCapture(event.pointerId);
		document.body.classList.remove('md-toc-resizing');
		writeWidth(dragWidth);
	};
	resizer.addEventListener('pointerup', endDrag);
	resizer.addEventListener('pointercancel', endDrag);

	resizer.addEventListener('dblclick', () => {
		writeWidth(undefined);
		applyWidth(undefined);
	});

	resizer.addEventListener('keydown', event => {
		// Moving the handle away from the sidebar's edge widens it.
		const outward = sidebarPosition() === 'left' ? 'ArrowRight' : 'ArrowLeft';
		const inward = sidebarPosition() === 'left' ? 'ArrowLeft' : 'ArrowRight';
		const delta = event.key === outward ? KEYBOARD_STEP : event.key === inward ? -KEYBOARD_STEP : 0;
		if (!delta) {
			return;
		}
		event.preventDefault();
		const width = clampWidth(currentWidth() + delta);
		applyWidth(width);
		writeWidth(width);
	});

	// Re-clamp the stored width when the preview pane itself is resized.
	window.addEventListener('resize', () => applyWidth(readWidth()));
	applyWidth(readWidth());
}
