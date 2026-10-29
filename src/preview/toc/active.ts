// Which entry is highlighted as the section being read, and the sections containing it.
import { HEADING_SELECTOR, NAV_ID } from './dom.ts'
import { isHidden, setTabStop } from './keyboard.ts'
import { ancestorIndices } from './outline.ts'
import { scrolling } from './scroll.ts'

/** The heading of the section being read: the last one scrolled to the top, or the last heading once the page is scrolled to the bottom. */
function findActiveHeading(headings: HTMLElement[]): HTMLElement | undefined {
	if (headings.length === 0) {
		return undefined
	}

	const scrollBottom = window.scrollY + window.innerHeight
	if (scrollBottom >= document.documentElement.scrollHeight - 2) {
		return headings[headings.length - 1]
	}

	// Active heading = last one at or above where a jump would land it (its scroll-margin-top),
	// with a little slack for rounding.
	let active = headings[0]

	for (const heading of headings) {
		const threshold = (parseFloat(getComputedStyle(heading).scrollMarginTop) || 0) + 8

		if (heading.getBoundingClientRect().top <= threshold) {
			active = heading
		} else {
			break
		}
	}

	return active
}

/** Which entry is shown as active: inside a collapsed section the active entry is hidden, so its closest visible parent is shown instead. */
function shownEntryIndex(links: HTMLAnchorElement[], activeIndex: number, ancestors: Set<number>): number {
	if (activeIndex < 0 || !isHidden(links[activeIndex])) {
		return activeIndex
	}

	// The ancestors come closest first.
	return [...ancestors].find(i => !isHidden(links[i])) ?? -1
}

/** Marks the entry shown as active, and tints the parents above it. */
function markLinks(links: HTMLAnchorElement[], shownIndex: number, ancestors: Set<number>): void {
	links.forEach((link, i) => {
		link.classList.toggle('active', i === shownIndex)

		if (i === shownIndex) {
			link.setAttribute('aria-current', 'location')
		} else {
			link.removeAttribute('aria-current')
		}

		// Parents above the entry shown as active (any below it are inside the collapsed section). The
		// document title contains everything, so as a parent it would always be tinted.
		link.classList.toggle(
			'active-ancestor',
			ancestors.has(i) && i < shownIndex && !link.classList.contains('md-toc-doc-title'),
		)
	})
}

/** Tabbing into the list lands on the entry shown as active. While focus is in the list, the focused entry stays the tab stop, unless a collapsed section has just hidden it. */
function updateTabStop(nav: HTMLElement, links: HTMLAnchorElement[], shownIndex: number): void {
	const stop = links.find(link => link.tabIndex === 0)

	if (!nav.contains(document.activeElement) || !stop || isHidden(stop)) {
		setTabStop(nav, links[shownIndex] ?? links.find(link => !isHidden(link)))
	}
}

/** Which entry is highlighted as the section being read, and the sections containing it. */
class ActiveHighlight {
	// The tests load this file in Node, without a DOM, so these only start as a Set and null.
	// Ids of the headings listed in the sidebar; headings deeper than maxDepth aren't in it.
	private listedIds = new Set<string>()
	// The entry that was last highlighted, so we don't update the DOM unnecessarily.
	private latestId: string | undefined | null = null
	// Told about every entry the highlight picks; see onActiveChange.
	private listener: ((id: string | undefined) => void) | undefined

	/** Sets which headings the sidebar lists, after a rebuild. */
	setListedIds(ids: Set<string>): void {
		this.listedIds = ids
	}

	/**
	 * Calls the listener each time the highlight picks its entry: when another one becomes active, and
	 * again after reset(). It runs before the list is marked, so it can still change which entries are hidden.
	 */
	onActiveChange(listener: (id: string | undefined) => void): void {
		this.listener = listener
	}

	/** Makes the next update highlight the active entry again, after the list changed. */
	reset(): void {
		this.latestId = null
	}

	/** Highlights the entry for the section being read, or the clicked one while its scroll is in flight. */
	update(): void {
		const pinned = scrolling.pinnedId

		if (pinned) {
			this.highlight(pinned)
			return
		}

		// Only listed headings: inside a section deeper than maxDepth, its listed parent is the active one.
		const listed = Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(h =>
			this.listedIds.has(h.id),
		)

		this.highlight(findActiveHeading(listed)?.id)
	}

	/** Highlights the entry for a heading, and tints the sections containing it. */
	highlight(id: string | undefined): void {
		if (this.latestId === id) return

		const nav = document.getElementById(NAV_ID)

		if (!nav) return

		this.latestId = id

		this.listener?.(id)

		const links = Array.from(nav.querySelectorAll('a'))
		const activeIndex = links.findIndex(link => link.dataset.target === id)
		const ancestors = ancestorIndices(
			links.map(l => ({ level: Number(l.dataset.level) })),
			activeIndex,
		)
		const shownIndex = shownEntryIndex(links, activeIndex, ancestors)

		markLinks(links, shownIndex, ancestors)

		if (shownIndex >= 0) {
			links[shownIndex].scrollIntoView({ block: 'nearest' })
		}

		updateTabStop(nav, links, shownIndex)
	}
}

export const activeHighlight = new ActiveHighlight()
