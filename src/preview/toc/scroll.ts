// Scrolling: to a heading when its entry is clicked, and keeping the highlight in step with the page.
import { SYNCED_SCROLL_EVENT } from '../../shared/constants.ts'
import { setActiveLink, updateActive } from './active.ts'
import { scrollBehavior } from './config.ts'
import { NAV_ID } from './dom.ts'

/** Briefly highlights a heading after jumping to it, so it's easy to see where you landed. */
function flashHeading(heading: HTMLElement) {
	heading.classList.remove('md-toc-flash')
	// Force a reflow so the animation restarts when the same heading is clicked again.
	void heading.offsetWidth
	heading.classList.add('md-toc-flash')
	heading.addEventListener('animationend', () => heading.classList.remove('md-toc-flash'), { once: true })
}

/** Where the page has to scroll for a heading to sit at the top, honoring its scroll-margin-top. */
function headingScrollTop(heading: HTMLElement) {
	const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0
	const top = window.scrollY + heading.getBoundingClientRect().top - margin
	const max = document.documentElement.scrollHeight - window.innerHeight
	return Math.min(Math.max(0, top), Math.max(0, max))
}

/** Scrolls to a heading when its entry is clicked, and keeps the highlight in step with the scroll position. */
class Scrolling {
	// How long the page has to be still before a click's scroll counts as finished. Covers clicks
	// that don't scroll at all, where no scrollend event fires.
	private static readonly SETTLE_MS = 150

	// The tests load this file in Node, without a DOM, so these only start as numbers and null.
	// While a TOC click's scroll is in flight, keep the clicked entry highlighted instead of
	// recomputing from scroll position (short sections or the end of the page would pick another).
	private pinned: string | null = null

	// Heading to flash once the scroll arrives, so a smooth scroll doesn't fade it before it's in view.
	private pinnedHeading: HTMLElement | null = null

	private settleTimer = 0

	// Our own animation rather than scrollIntoView's smooth behavior: the browser's takes up to
	// ~1.5s for long jumps, which feels sluggish for navigation. This one stays within 250-600ms.
	private scrollAnimation = 0

	private scrollFrame = 0

	/** The clicked entry's heading while its scroll is in flight, otherwise null. */
	get pinnedId(): string | null {
		return this.pinned
	}

	/** Handles clicks on the sidebar's entries, and keeps the highlight in step with the scroll position. */
	init(): void {
		// Capture phase, so we handle the click before the preview's own link handler can interfere.
		document.addEventListener('click', event => this.onClick(event), true)

		// The user taking over cancels the animation.
		for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
			window.addEventListener(type, () => this.stopScrollAnimation(), { capture: true, passive: true })
		}

		window.addEventListener('scrollend', () => this.onScrollEnd())
		window.addEventListener('scroll', () => this.onScroll(), { passive: true })
		// smooth-scroll-sync hides its gliding scroll events from regular listeners and fires this instead.
		window.addEventListener(SYNCED_SCROLL_EVENT, () => this.onScroll())
	}

	/** Scrolls to the heading of a clicked entry, keeping that entry highlighted on the way. */
	private onClick(event: MouseEvent): void {
		const link = event.target instanceof Element && event.target.closest<HTMLElement>(`#${NAV_ID} a`)

		if (!link) return

		event.preventDefault()
		event.stopPropagation()

		const target = document.getElementById(link.dataset.target ?? '')

		if (target) {
			this.pinActive(target)
			setActiveLink(target.id)

			if (scrollBehavior() === 'smooth') {
				this.animateScrollTo(headingScrollTop(target))
			} else {
				this.stopScrollAnimation()
				target.scrollIntoView({ block: 'start' })
			}
		}
	}

	/**
	 * Once the click-triggered scroll settles, goes back to tracking the scroll position.
	 * Each animation frame can fire its own scrollend, so those are ignored until the animation is done.
	 */
	private onScrollEnd(): void {
		if (!this.scrollAnimation) {
			this.settle()
		}
	}

	/** Updates the highlight once per frame while the page scrolls, and keeps a click's scroll from settling while it's still moving. */
	private onScroll(): void {
		if (this.pinned) {
			// Still moving towards the clicked heading.
			this.restartSettleTimer()
		}

		if (!this.scrollFrame) {
			this.scrollFrame = requestAnimationFrame(() => {
				this.scrollFrame = 0
				updateActive()
			})
		}
	}

	/** Keeps a clicked entry's heading highlighted until its scroll settles. */
	private pinActive(heading: HTMLElement): void {
		this.pinned = heading.id
		this.pinnedHeading = heading

		this.restartSettleTimer()
	}

	/** Starts the SETTLE_MS wait over, since the page is still moving. */
	private restartSettleTimer(): void {
		clearTimeout(this.settleTimer)

		// Through window, so the type checker sees the browser's setTimeout (which returns a number) even
		// when the tests, which have Node's types, import this file.
		this.settleTimer = window.setTimeout(() => this.settle(), Scrolling.SETTLE_MS)
	}

	/** Ends a click's scroll: unpins the entry and flashes its heading. */
	private settle(): void {
		clearTimeout(this.settleTimer)

		if (!this.pinned) return

		// Drop any recompute queued by the scroll so it can't override the clicked entry.
		cancelAnimationFrame(this.scrollFrame)

		this.scrollFrame = 0

		const heading = this.pinnedHeading

		this.pinned = null
		this.pinnedHeading = null

		if (heading && heading.isConnected) {
			flashHeading(heading)
		}
	}

	/** Scrolls smoothly to top, in 250-600ms depending on distance. */
	private animateScrollTo(top: number): void {
		this.stopScrollAnimation()

		const start = window.scrollY
		const distance = top - start

		if (Math.abs(distance) < 1) return

		const duration = Math.min(600, Math.max(250, Math.abs(distance) * 0.15))
		const startTime = performance.now()

		const step = (now: number) => {
			const t = Math.min(1, (now - startTime) / duration)
			const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

			window.scrollTo({ top: start + distance * eased, behavior: 'instant' })

			if (t < 1) {
				this.scrollAnimation = requestAnimationFrame(step)
			} else {
				this.scrollAnimation = 0
				// Arrived: settle on the next frame, after the last scroll event has been handled.
				requestAnimationFrame(() => this.settle())
			}
		}

		this.scrollAnimation = requestAnimationFrame(step)
	}

	/** Stops a smooth scroll where it is. */
	private stopScrollAnimation(): void {
		cancelAnimationFrame(this.scrollAnimation)
		this.scrollAnimation = 0
	}
}

export const scrolling = new Scrolling()
