// Which entry is highlighted as the section being read, and the sections containing it.
import { HEADING_SELECTOR, NAV_ID } from './dom.ts';
import { isHidden, setTabStop } from './keyboard.ts';
import { ancestorIndices } from './outline.ts';
import { pinnedId } from './scroll.ts';

// Ids of the headings listed in the sidebar; headings deeper than maxDepth aren't in it.
let tocIds = new Set<string>();

// Contains the entry that was last highlighted, so we don't update the DOM unnecessarily.
let latestActiveId: string | undefined | null = null;

/** The heading of the section being read: the last one scrolled to the top, or the last heading once the page is scrolled to the bottom. */
function findActiveHeading(headings: HTMLElement[]) {
	if (headings.length === 0) {
		return undefined;
	}
	const scrollBottom = window.scrollY + window.innerHeight;
	if (scrollBottom >= document.documentElement.scrollHeight - 2) {
		return headings[headings.length - 1];
	}

	// Active heading = last one at or above where a jump would land it (its scroll-margin-top),
	// with a little slack for rounding.
	let active = headings[0];
	for (const heading of headings) {
		const threshold = (parseFloat(getComputedStyle(heading).scrollMarginTop) || 0) + 8;
		if (heading.getBoundingClientRect().top <= threshold) {
			active = heading;
		} else {
			break;
		}
	}
	return active;
}

/** Sets which headings the sidebar lists, after a rebuild. */
export function setTocIds(ids: Set<string>): void {
	tocIds = ids;
}

/** Makes the next update highlight the active entry again, after the list changed. */
export function resetActive(): void {
	latestActiveId = null;
}

/** Highlights the entry for a heading, and tints the sections containing it. */
export function setActiveLink(id: string | undefined): void {
	if (latestActiveId === id) {
		return;
	}

	const nav = document.getElementById(NAV_ID);
	if (!nav) {
		return;
	}

	latestActiveId = id;

	const links = Array.from(nav.querySelectorAll('a'));
	const activeIndex = links.findIndex(link => link.dataset.target === id);

	const ancestors = ancestorIndices(
		links.map(l => ({ level: Number(l.dataset.level) })),
		activeIndex,
	);
	// Inside a collapsed section the active entry is hidden; show its closest visible parent as active
	// instead. The ancestors come closest first.
	const shownIndex =
		activeIndex >= 0 && isHidden(links[activeIndex])
			? ([...ancestors].find(i => !isHidden(links[i])) ?? -1)
			: activeIndex;

	links.forEach((link, i) => {
		link.classList.toggle('active', i === shownIndex);
		if (i === shownIndex) {
			link.setAttribute('aria-current', 'location');
		} else {
			link.removeAttribute('aria-current');
		}
		// Parents above the entry shown as active (any below it are inside the collapsed section). The
		// document title contains everything, so as a parent it would always be tinted.
		link.classList.toggle(
			'active-ancestor',
			ancestors.has(i) && i < shownIndex && !link.classList.contains('md-toc-doc-title'),
		);
	});
	if (shownIndex >= 0) {
		links[shownIndex].scrollIntoView({ block: 'nearest' });
	}

	// Tabbing into the list lands on the entry shown as active. While focus is in the list, the
	// focused entry stays the tab stop, unless a collapsed section has just hidden it.
	const stop = links.find(link => link.tabIndex === 0);
	if (!nav.contains(document.activeElement) || !stop || isHidden(stop)) {
		setTabStop(nav, links[shownIndex] ?? links.find(link => !isHidden(link)));
	}
}

/** Highlights the entry for the section being read, or the clicked one while its scroll is in flight. */
export function updateActive(): void {
	const pinned = pinnedId();
	if (pinned) {
		setActiveLink(pinned);
		return;
	}
	// Only listed headings: inside a section deeper than maxDepth, its listed parent is the active one.
	const listed = Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(h => tocIds.has(h.id));
	const active = findActiveHeading(listed);
	setActiveLink(active?.id);
}
