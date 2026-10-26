// Scrolling: to a heading when its entry is clicked, and keeping the highlight in step with the page.
import { SYNCED_SCROLL_EVENT } from '../../shared/constants.ts';
import { setActiveLink, updateActive } from './active.ts';
import { scrollBehavior } from './config.ts';
import { NAV_ID } from './dom.ts';

// How long the page has to be still before a click's scroll counts as finished. Covers clicks
// that don't scroll at all, where no scrollend event fires.
const SETTLE_MS = 150;

// While a TOC click's scroll is in flight, keep the clicked entry highlighted instead of
// recomputing from scroll position (short sections or the end of the page would pick another).
let pinned: string | null = null;
// Heading to flash once the scroll arrives, so a smooth scroll doesn't fade it before it's in view.
let pinnedHeading: HTMLElement | null = null;
let settleTimer = 0;
// Our own animation rather than scrollIntoView's smooth behavior: the browser's takes up to
// ~1.5s for long jumps, which feels sluggish for navigation. This one stays within 250-600ms.
let scrollAnimation = 0;
let scrollFrame = 0;

/** Keeps a clicked entry's heading highlighted until its scroll settles. */
function pinActive(heading: HTMLElement) {
	pinned = heading.id;
	pinnedHeading = heading;
	restartSettleTimer();
}

/** Starts the SETTLE_MS wait over, since the page is still moving. */
function restartSettleTimer() {
	clearTimeout(settleTimer);
	// Through window, so the type checker sees the browser's setTimeout (which returns a number) even
	// when the tests, which have Node's types, import this file.
	settleTimer = window.setTimeout(settle, SETTLE_MS);
}

/** Ends a click's scroll: unpins the entry and flashes its heading. */
function settle() {
	clearTimeout(settleTimer);
	if (!pinned) {
		return;
	}
	// Drop any recompute queued by the scroll so it can't override the clicked entry.
	cancelAnimationFrame(scrollFrame);
	scrollFrame = 0;
	const heading = pinnedHeading;
	pinned = null;
	pinnedHeading = null;
	if (heading && heading.isConnected) {
		flashHeading(heading);
	}
}

/** Briefly highlights a heading after jumping to it, so it's easy to see where you landed. */
function flashHeading(heading: HTMLElement) {
	heading.classList.remove('md-toc-flash');
	// Force a reflow so the animation restarts when the same heading is clicked again.
	void heading.offsetWidth;
	heading.classList.add('md-toc-flash');
	heading.addEventListener('animationend', () => heading.classList.remove('md-toc-flash'), { once: true });
}

/** Where the page has to scroll for a heading to sit at the top, honoring its scroll-margin-top. */
function headingScrollTop(heading: HTMLElement) {
	const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
	const top = window.scrollY + heading.getBoundingClientRect().top - margin;
	const max = document.documentElement.scrollHeight - window.innerHeight;
	return Math.min(Math.max(0, top), Math.max(0, max));
}

/** Scrolls smoothly to top, in 250-600ms depending on the distance. */
function animateScrollTo(top: number) {
	stopScrollAnimation();
	const start = window.scrollY;
	const distance = top - start;
	if (Math.abs(distance) < 1) {
		return;
	}
	const duration = Math.min(600, Math.max(250, Math.abs(distance) * 0.15));
	const startTime = performance.now();
	const step = (now: number) => {
		const t = Math.min(1, (now - startTime) / duration);
		const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
		window.scrollTo({ top: start + distance * eased, behavior: 'instant' });
		if (t < 1) {
			scrollAnimation = requestAnimationFrame(step);
		} else {
			scrollAnimation = 0;
			// Arrived: settle on the next frame, after the last scroll event has been handled.
			requestAnimationFrame(settle);
		}
	};
	scrollAnimation = requestAnimationFrame(step);
}

/** Stops a smooth scroll where it is. */
function stopScrollAnimation() {
	cancelAnimationFrame(scrollAnimation);
	scrollAnimation = 0;
}

/** Updates the highlight once per frame while the page scrolls, and keeps a click's scroll from settling while it's still moving. */
function onScroll() {
	if (pinned) {
		// Still moving towards the clicked heading.
		restartSettleTimer();
	}
	if (!scrollFrame) {
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = 0;
			updateActive();
		});
	}
}

/** The clicked entry's heading while its scroll is in flight, otherwise null. */
export function pinnedId(): string | null {
	return pinned;
}

/** Handles clicks on the sidebar's entries, and keeps the highlight in step with the scroll position. */
export function initScrolling(): void {
	// Handle clicks ourselves so the preview's own link handler doesn't interfere.
	document.addEventListener(
		'click',
		event => {
			const link = event.target instanceof Element && event.target.closest<HTMLElement>('#' + NAV_ID + ' a');
			if (!link) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const target = document.getElementById(link.dataset.target ?? '');
			if (target) {
				pinActive(target);
				setActiveLink(target.id);
				if (scrollBehavior() === 'smooth') {
					animateScrollTo(headingScrollTop(target));
				} else {
					stopScrollAnimation();
					target.scrollIntoView({ block: 'start' });
				}
			}
		},
		true,
	);

	// The user taking over cancels the animation.
	for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
		window.addEventListener(type, stopScrollAnimation, { capture: true, passive: true });
	}

	// Once the click-triggered scroll settles, go back to tracking the scroll position.
	// Each animation frame can fire its own scrollend, so ignore those until the animation is done.
	window.addEventListener('scrollend', () => {
		if (!scrollAnimation) {
			settle();
		}
	});

	window.addEventListener('scroll', onScroll, { passive: true });
	// smooth-scroll-sync hides its gliding scroll events from regular listeners and fires this instead.
	window.addEventListener(SYNCED_SCROLL_EVENT, onScroll);
}
