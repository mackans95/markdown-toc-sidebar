// Moving between the sidebar's entries with the keyboard.
import { ancestorIndices, hasChildren } from './outline.ts'

/**
 * Where a key moves focus in the list: the index of the entry to focus, the same index when there's
 * nowhere to go, or undefined for keys the list doesn't use. Entries hidden in collapsed sections
 * are skipped. ArrowRight goes to the first child and ArrowLeft to the parent; expanding and
 * collapsing with those keys is handled before this.
 */
export function focusTarget({
	entries,
	index,
	key,
}: {
	entries: { level: number; hidden?: boolean }[]
	index: number
	key: string
}): number | undefined {
	const visible = entries.flatMap((entry, i) => (entry.hidden ? [] : [i]))
	const position = visible.indexOf(index)
	switch (key) {
		case 'ArrowDown':
			return visible[Math.min(position + 1, visible.length - 1)]
		case 'ArrowUp':
			return visible[Math.max(position - 1, 0)]
		case 'Home':
			return visible[0]
		case 'End':
			return visible[visible.length - 1]
		case 'ArrowRight':
			return hasChildren(entries, index) && !entries[index + 1].hidden ? index + 1 : index
		case 'ArrowLeft': {
			// ancestorIndices lists the closest parent first.
			const [parent] = ancestorIndices(entries, index)
			return parent ?? index
		}
		default:
			return undefined
	}
}

/** The whole list is a single tab stop (the arrow keys move within it), so Tab gets past it in one go. */
export function setTabStop(nav: HTMLElement, stop: HTMLAnchorElement | undefined): void {
	for (const link of nav.querySelectorAll('a')) {
		link.tabIndex = link === stop ? 0 : -1
	}
}

/**
 * Arrow keys, Home and End move between the visible entries. On an entry with sections under it,
 * ArrowRight expands and ArrowLeft collapses (markdownTocSidebar.collapsible) before moving.
 */
export function onNavKeydown(e: KeyboardEvent): void {
	const isModifierKeyHeld = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey
	const isTargetElement = e.target instanceof Element

	if (isModifierKeyHeld || !isTargetElement) return

	const nav = e.currentTarget as HTMLElement
	// A chevron focused by a click stands in for its entry.
	const current = e.target.closest('a') ?? e.target.closest('li')?.querySelector('a')
	const links = Array.from(nav.querySelectorAll('a'))
	const index = current ? links.indexOf(current) : -1
	if (!current || index < 0) return

	const chevron = current.closest('li')?.querySelector<HTMLButtonElement>('.md-toc-chevron')
	const expanded = chevron?.getAttribute('aria-expanded')
	if (
		chevron &&
		((e.key === 'ArrowRight' && expanded === 'false') || (e.key === 'ArrowLeft' && expanded === 'true'))
	) {
		e.preventDefault()
		e.stopPropagation()
		chevron.click()
		current.focus()
		return
	}

	const entries = links.map(link => ({ level: Number(link.dataset.level), hidden: isHidden(link) }))
	const target = focusTarget({ entries, index, key: e.key })
	if (target === undefined) return
	// Also at the ends of the list, so the keys don't scroll the page instead.
	e.preventDefault()
	e.stopPropagation()
	if (target !== index) {
		links[target].focus()
	}
}

/** Whether an entry is inside a collapsed section. */
export function isHidden(link: Element): boolean {
	return !!link.closest('li')?.hidden
}
