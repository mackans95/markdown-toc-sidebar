// Collapsed sections (markdownTocSidebar.collapsible), remembered per file.

// The collapsed sections of each file, by heading id, with when they last changed.
export type CollapsedStore = Record<string, { ids: string[]; time: number }>;

// Stores one file's collapsed sections in the store. A file with nothing collapsed is dropped, and
// only the `max` most recently changed files are kept.
export function storeCollapsed(
	store: CollapsedStore,
	source: string,
	ids: string[],
	time: number,
	max: number,
): CollapsedStore {
	const next = { ...store };
	if (ids.length > 0) {
		next[source] = { ids, time };
	} else {
		delete next[source];
	}
	const newest = Object.entries(next)
		.sort((a, b) => b[1].time - a[1].time)
		.slice(0, max);
	return Object.fromEntries(newest);
}
