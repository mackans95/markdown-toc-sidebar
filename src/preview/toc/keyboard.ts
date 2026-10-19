// Moving between the sidebar's entries with the keyboard.
import { ancestorIndices, hasChildren } from './outline.ts';

// Where a key moves focus in the list: the index of the entry to focus, the same index when there's
// nowhere to go, or undefined for keys the list doesn't use. Entries hidden in collapsed sections
// are skipped. ArrowRight goes to the first child and ArrowLeft to the parent; expanding and
// collapsing with those keys is handled before this.
export function focusTarget(
	entries: { level: number; hidden?: boolean }[],
	index: number,
	key: string,
): number | undefined {
	const visible = entries.flatMap((entry, i) => (entry.hidden ? [] : [i]));
	const position = visible.indexOf(index);
	switch (key) {
		case 'ArrowDown':
			return visible[Math.min(position + 1, visible.length - 1)];
		case 'ArrowUp':
			return visible[Math.max(position - 1, 0)];
		case 'Home':
			return visible[0];
		case 'End':
			return visible[visible.length - 1];
		case 'ArrowRight':
			return hasChildren(entries, index) && !entries[index + 1].hidden ? index + 1 : index;
		case 'ArrowLeft': {
			// ancestorIndices lists the closest parent first.
			const [parent] = ancestorIndices(entries, index);
			return parent ?? index;
		}
		default:
			return undefined;
	}
}
