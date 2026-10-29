// The outline the sidebar lists: which headings, how deep, and which sections contain which.
// The functions only ask for the fields they use, so the tests can pass in bare levels.
import type { BuildOptions, EntryFields } from '../../types/preview.ts'

/**
 * Numbers entries by their place in the outline: an entry's parent is the closest earlier one
 * with a lower level, the same rule ancestorIndices uses. A skipped level (## then ####) doesn't
 * add a 0, and a heading that comes back up past a deeper one (#### then ###) continues its count.
 */
function addNumbers(entries: { level: number; number?: string }[]): void {
	// The open sections from the outermost in, with how many entries each level has had so far.
	const stack: { level: number; count: number }[] = []
	for (const entry of entries) {
		let closed
		while (stack.length > 0 && stack[stack.length - 1].level > entry.level) {
			closed = stack.pop()
		}
		const top = stack[stack.length - 1]
		if (top && top.level === entry.level) {
			top.count++
		} else {
			// A new level here; if a deeper one was just closed, this entry is its next sibling.
			stack.push({ level: entry.level, count: closed ? closed.count + 1 : 1 })
		}
		entry.number = stack.map(section => section.count).join('.')
	}
}

/** The headings the sidebar lists, with their depth in the list, plus the title and numbers when the options ask for them. */
export function buildEntries<T extends { level: number }>(
	headings: T[],
	options: BuildOptions = {},
): (T & EntryFields)[] {
	const maxDepth = options.maxDepth ?? 6
	const topHeading = options.topHeading ?? 'list'
	const baseLevel = Math.min(...headings.map(h => h.level))
	// Never hide the document's top level: an empty list would hide the sidebar, and with it the
	// settings menu needed to change maxDepth back.
	const limit = Math.max(maxDepth, baseLevel)

	// A title only when the first heading is the only one at the top level, like a `#` above `##` sections.
	const hasTitle =
		topHeading === 'title' &&
		headings.length > 0 &&
		headings[0].level === baseLevel &&
		headings.filter(h => h.level === baseLevel).length === 1
	// The rest is indented from its own top level, so `#` followed by `###` sections doesn't leave a gap.
	const rest = hasTitle ? headings.slice(1) : headings
	const listBase = Math.min(...rest.map(h => h.level))

	const entries = headings
		.map((h, i): T & EntryFields => {
			if (hasTitle && i === 0) {
				return { ...h, depth: 0, isTitle: true }
			}
			return { ...h, depth: h.level - listBase }
		})
		.filter(h => h.level <= limit)

	if (options.numbering) {
		addNumbers(entries.filter(entry => !entry.isTitle))
	}
	return entries
}

/**
 * The sections containing the active one: walking back up the list, each entry with a
 * lower level than the last one found is the next enclosing section.
 */
export function ancestorIndices(entries: { level: number }[], index: number): Set<number> {
	const ancestors = new Set<number>()
	if (index >= 0) {
		let level = entries[index].level

		for (let i = index - 1; i >= 0 && level > 1; i--) {
			const entryLevel = entries[i].level
			if (entryLevel < level) {
				ancestors.add(i)
				level = entryLevel
			}
		}
	}

	return ancestors
}

/**
 * Whether an entry has sections under it: the next entry is deeper. Same rule as ancestorIndices,
 * so a skipped level (## then ####) still counts as a child.
 */
export function hasChildren(entries: { level: number }[], index: number): boolean {
	return index + 1 < entries.length && entries[index + 1].level > entries[index].level
}

/**
 * The entries hidden by collapsed sections: everything after a collapsed entry that is deeper than
 * it, up to the next entry at its level or above. A collapsed section inside a hidden one changes
 * nothing, and a collapsed entry without children hides nothing.
 */
export function hiddenIndices(entries: { id: string; level: number }[], collapsedIds: Set<string>): Set<number> {
	const hidden = new Set<number>()
	let collapsedLevel: number | null = null
	entries.forEach((entry, i) => {
		if (collapsedLevel !== null && entry.level > collapsedLevel) {
			hidden.add(i)
			return
		}
		collapsedLevel = collapsedIds.has(entry.id) ? entry.level : null
	})
	return hidden
}

/**
 * Whether there's nothing left to fold: every section you can see is collapsed. Sections inside
 * collapsed ones are hidden, so they don't count. False when the list has no sections at all.
 */
export function allFolded(entries: { id: string; level: number }[], collapsedIds: Set<string>): boolean {
	const hidden = hiddenIndices(entries, collapsedIds)
	const sections = entries.filter((_, i) => !hidden.has(i) && hasChildren(entries, i))
	return sections.length > 0 && sections.every(entry => collapsedIds.has(entry.id))
}
