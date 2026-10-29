// Tooltips for the header buttons, the arrows, the resizer and entries whose text is cut off. The
// webview doesn't show the native ones for title, and the list would clip anything drawn inside it,
// so one element on <body> shows them all, after the same short delay as VS Code's own hovers.
import { sidebarPosition } from './config.ts'
import { NAV_ID, RESIZER_ID, SETTINGS_MENU_ID, TOOLTIP_ID } from './dom.ts'
import type { TooltipPositionParams } from '../../types/preview.ts'

// How long the pointer rests on an element before its tooltip shows.
const SHOW_DELAY_MS = 500
// The space between a tooltip and its element, and between a tooltip and the window's edges.
const GAP = 6
const MARGIN = 4
const VISIBLE_CLASS = 'md-toc-tooltip-visible'

/** The element with a tooltip that an event happened in, if any. */
function tooltipTarget(node: EventTarget | null): HTMLElement | undefined {
	return (node instanceof Element && node.closest<HTMLElement>('[data-tooltip]')) || undefined
}

/**
 * Whether a tooltip would tell something the element doesn't already show: an entry only needs one
 * when its text is cut off, and the cog none while its menu is open.
 */
function shouldShow(target: HTMLElement): boolean {
	// The toggle has aria-expanded too, true while the sidebar is shown; only the cog opens a popup.
	if (target.hasAttribute('aria-haspopup') && target.getAttribute('aria-expanded') === 'true') {
		return false
	}

	const isEntry = target instanceof HTMLAnchorElement && !!target.closest(`#${NAV_ID}`)

	return !isEntry || target.scrollWidth > target.clientWidth
}

/**
 * Where an element's tooltip goes: entries get it above their text, the buttons below them, opening
 * towards the middle of the preview. The resizer runs the full height, so its tooltip goes by the pointer.
 */
function sideFor(
	target: HTMLElement,
	pointer: { x: number; y: number },
): Pick<TooltipPositionParams, 'anchor' | 'placement' | 'align'> {
	const towardsMiddle = sidebarPosition() === 'left' ? 'start' : 'end'

	if (target.id === RESIZER_ID) {
		const anchor = { left: pointer.x, right: pointer.x, top: pointer.y, bottom: pointer.y }
		return { anchor, placement: 'below', align: towardsMiddle }
	}

	const anchor = target.getBoundingClientRect()

	if (target.closest(`#${NAV_ID}`)) {
		return { anchor, placement: 'above', align: 'start' }
	}

	// The menu opens towards the middle already, and its close button sits at its right edge.
	return {
		anchor,
		placement: 'below',
		align: target.closest(`#${SETTINGS_MENU_ID}`) ? 'end' : towardsMiddle,
	}
}

/** Where a tooltip goes: on the asked side of its anchor unless only the other side has room, and pushed inside the window. */
export function tooltipPosition({ anchor, size, viewport, placement, align }: TooltipPositionParams): {
	left: number
	top: number
} {
	const above = anchor.top - GAP - size.height
	const below = anchor.bottom + GAP
	const fitsAbove = above >= MARGIN
	const fitsBelow = below + size.height <= viewport.height - MARGIN
	const goesAbove = placement === 'above' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove

	const preferredLeft = align === 'start' ? anchor.left : anchor.right - size.width
	// Max outside: a tooltip wider than the window keeps its start in view.
	const left = Math.max(MARGIN, Math.min(preferredLeft, viewport.width - MARGIN - size.width))

	return {
		left,
		top: goesAbove ? above : below,
	}
}

/** The one tooltip, shown for the element the pointer rests on. */
class Tooltip {
	// Created the first time a tooltip shows, so creating this doesn't need the DOM.
	private element: HTMLDivElement | undefined
	// The element under the pointer that has a tooltip, also while it's waiting to show or dismissed by a click.
	private target: HTMLElement | undefined
	private timer = 0
	// Where the pointer last was, for the resizer's tooltip.
	private pointer = { x: 0, y: 0 }

	/** Starts listening to the pointer, and to clicks and scrolling, which hide the tooltip. */
	init(): void {
		document.addEventListener('pointerover', e => this.onPointerOver(e))
		document.addEventListener('pointerout', e => this.onPointerOut(e))
		document.addEventListener('pointermove', e => (this.pointer = { x: e.clientX, y: e.clientY }), {
			passive: true,
		})
		document.addEventListener('pointerdown', () => this.dismiss())
		// Scroll events don't bubble, so the list's own only reach the document while capturing.
		document.addEventListener('scroll', () => this.dismiss(), { capture: true, passive: true })
	}

	/** Starts the delay for the element the pointer moved onto, unless it's the one already being handled. */
	private onPointerOver(e: PointerEvent): void {
		const target = tooltipTarget(e.target)

		// Moving onto a child, like a button's icon, is still the same element.
		if (target === this.target) return

		this.hide()

		if (!target) return

		this.target = target
		this.timer = window.setTimeout(() => this.show(), SHOW_DELAY_MS)
	}

	/** Hides the tooltip when the pointer leaves its element, but not when it only moves onto a child of it. */
	private onPointerOut(e: PointerEvent): void {
		const isInside = e.relatedTarget instanceof Node && !!this.target?.contains(e.relatedTarget)
		if (!isInside) {
			this.hide()
		}
	}

	/** Shows the element's tooltip next to it, if it still has something to tell. */
	private show(): void {
		const target = this.target

		// A rebuild of the sidebar may have replaced the element during the delay.
		if (!target?.isConnected || !shouldShow(target)) return

		const element = this.element ?? this.createElement()
		element.textContent = target.dataset.tooltip!
		// Measured at the top left, so the last position near an edge doesn't squeeze the text into more lines.
		element.style.left = '0px'
		element.style.top = '0px'

		const { width, height } = element.getBoundingClientRect()

		const { left, top } = tooltipPosition({
			...sideFor(target, this.pointer),
			size: { width, height },
			viewport: { width: window.innerWidth, height: window.innerHeight },
		})
		element.style.left = `${left}px`
		element.style.top = `${top}px`
		element.classList.add(VISIBLE_CLASS)
	}

	/** Hides the tooltip after a click or scroll; it shows again once the pointer moves onto another element. */
	private dismiss(): void {
		clearTimeout(this.timer)
		this.element?.classList.remove(VISIBLE_CLASS)
	}

	/** Hides the tooltip and forgets its element, once the pointer has left it. */
	private hide(): void {
		this.dismiss()
		this.target = undefined
	}

	/** The tooltip element, hidden until show() places it. */
	private createElement(): HTMLDivElement {
		const element = document.createElement('div')
		element.id = TOOLTIP_ID
		// The elements already have the text as their aria-label, or as their own text.
		element.setAttribute('aria-hidden', 'true')
		document.body.appendChild(element)
		this.element = element
		return element
	}
}

export const tooltip = new Tooltip()
