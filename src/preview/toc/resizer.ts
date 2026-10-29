// The handle on the sidebar's inner edge that changes its width, by dragging or with the arrow keys.
import { readStored, writeStored } from '../storage.ts'
import { sidebarPosition } from './config.ts'
import { keepDoubleClickInside, NAV_ID, RESIZER_ID } from './dom.ts'

const WIDTH_KEY = 'md-toc-sidebar.width'
const MIN_WIDTH = 140
// Always leave at least this much room for the document itself.
const MIN_CONTENT_WIDTH = 240
const KEYBOARD_STEP = 16

// The width while the handle is being dragged, saved once the drag ends.
let dragWidth: number | undefined

/** The width the user chose, or undefined for the default. */
function readWidth(): number | undefined {
	const width = Number(readStored(WIDTH_KEY))
	return width > 0 ? width : undefined
}

/** Remembers the width the user chose; undefined goes back to the default. */
function writeWidth(width: number | undefined): void {
	writeStored(WIDTH_KEY, width === undefined ? undefined : String(Math.round(width)))
}

/** Width of the area fixed elements are laid out in: excludes the preview's own scrollbar. */
function viewportWidth(): number {
	return document.documentElement.clientWidth
}

/** Keeps a width between MIN_WIDTH and what leaves MIN_CONTENT_WIDTH for the document. */
function clampWidth(width: number): number {
	const max = Math.max(MIN_WIDTH, viewportWidth() - MIN_CONTENT_WIDTH)
	return Math.min(Math.max(width, MIN_WIDTH), max)
}

/**
 * A user-chosen width overrides the responsive default from toc.css; undefined restores it.
 * The stored value is kept unclamped so a narrow window doesn't permanently shrink it.
 */
function applyWidth(width: number | undefined): void {
	const root = document.documentElement
	if (width === undefined) {
		root.style.removeProperty('--md-toc-width')
	} else {
		root.style.setProperty('--md-toc-width', clampWidth(width) + 'px')
	}
	updateResizerValue()
}

/** The sidebar's current width. The nav is created on the first build, which runs before any input reaches the resizer. */
function navWidth(): number {
	return document.getElementById(NAV_ID)!.getBoundingClientRect().width
}

/** The resize handle on the sidebar's inner edge: a vertical separator that can be focused. */
function createResizer(): HTMLDivElement {
	const resizer = document.createElement('div')
	resizer.id = RESIZER_ID
	resizer.tabIndex = 0
	resizer.setAttribute('role', 'separator')
	resizer.setAttribute('aria-orientation', 'vertical')
	resizer.setAttribute('aria-controls', NAV_ID)
	resizer.setAttribute('aria-label', 'Resize table of contents')
	resizer.setAttribute('aria-valuemin', String(MIN_WIDTH))
	resizer.dataset.tooltip = 'Drag to resize, double-click to reset'

	keepDoubleClickInside(resizer)

	return resizer
}

/** Starts a drag when the main button goes down on the handle. */
function startDrag(e: PointerEvent, resizer: HTMLElement): void {
	if (e.button !== 0) return

	// No preventDefault here: it would also suppress the double-click used to reset the width.
	// Text selection during the drag is prevented by the md-toc-resizing class instead.
	resizer.setPointerCapture(e.pointerId)
	document.body.classList.add('md-toc-resizing')
	dragWidth = navWidth()
}

/** Follows the pointer while dragging: the sidebar is pinned to one edge, so its width is the pointer's distance from that edge. */
function drag(e: PointerEvent, resizer: HTMLElement): void {
	if (!resizer.hasPointerCapture(e.pointerId)) return

	const distance = sidebarPosition() === 'left' ? e.clientX : viewportWidth() - e.clientX
	dragWidth = clampWidth(distance)
	applyWidth(dragWidth)
}

/** Ends a drag, also a cancelled one, and remembers the width it ended at. */
function endDrag(e: PointerEvent, resizer: HTMLElement): void {
	if (!resizer.hasPointerCapture(e.pointerId)) return

	resizer.releasePointerCapture(e.pointerId)
	document.body.classList.remove('md-toc-resizing')
	writeWidth(dragWidth)
}

/** Goes back to the default width from toc.css. */
function resetWidth(): void {
	writeWidth(undefined)
	applyWidth(undefined)
}

/** How much an arrow key changes the width: moving the handle away from the sidebar's edge widens it. 0 for other keys. */
function keyboardDelta(key: string): number {
	const outward = sidebarPosition() === 'left' ? 'ArrowRight' : 'ArrowLeft'
	const inward = sidebarPosition() === 'left' ? 'ArrowLeft' : 'ArrowRight'

	return key === outward ? KEYBOARD_STEP : key === inward ? -KEYBOARD_STEP : 0
}

/** Changes the width by KEYBOARD_STEP with the arrow keys, and remembers it. */
function onResizerKeyDown(e: KeyboardEvent): void {
	const delta = keyboardDelta(e.key)

	if (!delta) return

	e.preventDefault()

	const width = clampWidth(navWidth() + delta)

	applyWidth(width)
	writeWidth(width)
}

/** Adds the resize handle and applies the remembered width. */
export function initResizer(): void {
	const resizer = createResizer()
	document.body.appendChild(resizer)

	resizer.addEventListener('pointerdown', e => startDrag(e, resizer))
	resizer.addEventListener('pointermove', e => drag(e, resizer))
	resizer.addEventListener('pointerup', e => endDrag(e, resizer))
	resizer.addEventListener('pointercancel', e => endDrag(e, resizer))
	resizer.addEventListener('dblclick', resetWidth)
	resizer.addEventListener('keydown', onResizerKeyDown)

	// Re-clamp the stored width when the preview pane itself is resized.
	window.addEventListener('resize', () => applyWidth(readWidth()))
	applyWidth(readWidth())
}

/** Updates the handle's aria-valuenow to the sidebar's current width. */
export function updateResizerValue(): void {
	const resizer = document.getElementById(RESIZER_ID)
	const nav = document.getElementById(NAV_ID)
	if (resizer && nav) {
		resizer.setAttribute('aria-valuenow', String(Math.round(nav.getBoundingClientRect().width)))
	}
}
