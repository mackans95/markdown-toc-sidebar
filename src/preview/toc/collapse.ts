// Collapsed sections (markdownTocSidebar.collapsible), remembered per file.
import { keepNewest, readStoredJson, writeStored } from '../storage.ts'
import { activeHighlight } from './active.ts'
import { readConfig } from './config.ts'
import { NAV_ID } from './dom.ts'
import { ICON_CHEVRON, ICON_FOLD_ALL, ICON_UNFOLD_ALL } from './icons.ts'
import { allFolded, followCollapsedIds, hasChildren, hiddenIndices } from './outline.ts'
import type { CollapsedStore } from '../../types/preview.ts'

/**
 * The file shown in the preview, from the data the built-in preview renders into the page. Without
 * that data, reading it throws and there's no file.
 */
function previewSource(): string | undefined {
	try {
		return JSON.parse(document.getElementById('vscode-markdown-preview-data')!.dataset.settings!).source
	} catch {
		return undefined
	}
}

/** The list's items, with the id and level of each entry. */
function readList(nav: HTMLElement): { items: HTMLLIElement[]; entries: { id: string; level: number }[] } {
	const items = Array.from(nav.querySelectorAll<HTMLLIElement>('ul > li'))
	const entries = items.map(item => {
		const link = item.querySelector('a')!
		return { id: link.dataset.target!, level: Number(link.dataset.level) }
	})
	return { items, entries }
}

/** Whether markdownTocSidebar.autoCollapse folds the sections to follow where you're reading; it needs collapsible sections. */
function isFollowing(): boolean {
	return readConfig('collapsible') === 'true' && readConfig('autoCollapse') === 'true'
}

/** Show Unfold All once everything you can see is folded, and Fold All otherwise. */
function updateFoldAllButton(nav: HTMLElement, folded: boolean): void {
	const button = nav.querySelector<HTMLButtonElement>('.md-toc-fold-all')

	if (!button) return

	const label = folded ? 'Unfold All' : 'Fold All'
	// Compare by name, like updateToggle: the browser re-serializes innerHTML, so comparing markup never matches.
	if (button.dataset.icon !== label) {
		button.dataset.icon = label
		button.innerHTML = folded ? ICON_UNFOLD_ALL : ICON_FOLD_ALL
	}
	button.setAttribute('aria-label', label)
	button.dataset.tooltip = label
}

/**
 * The collapsed sections (markdownTocSidebar.collapsible) of the file in the preview. Saved per file,
 * so they're still collapsed after switching files, editing or reopening the preview.
 */
class CollapsedSections {
	private static readonly STORAGE_KEY = 'md-toc-sidebar.collapsed-sections'
	private static readonly MAX_REMEMBERED_FILES = 50
	// The collapsed sections, by heading id.
	private ids = new Set<string>()
	// The file the ids belong to.
	private source: string | undefined
	// Follow mode's own collapsed sections, never saved; undefined until it has followed an entry.
	private followIds: Set<string> | undefined
	// The entry follow mode last folded the list around, so picking the same one again keeps your own clicks.
	private followedId: string | undefined
	// Whether follow mode was on at the last load(), to notice it being turned on or off.
	private following = false

	/** Picks up the saved sections when the preview shows a different file than before, and starts following afresh then or when follow mode is turned on or off. */
	load(): void {
		const source = previewSource()
		const following = isFollowing()

		if (source !== this.source || following !== this.following) {
			this.following = following
			this.followIds = undefined
			this.followedId = undefined
		}
		if (source === this.source) return

		this.source = source
		this.ids = new Set((source && this.readStore()[source]?.ids) || [])
	}

	/**
	 * The button before an entry that has sections under it.
	 * A sibling of the link rather than inside it, so clicking it never scrolls.
	 */
	createChevron(entry: { id: string; text: string }): HTMLButtonElement {
		const chevron = document.createElement('button')
		chevron.type = 'button'
		chevron.className = 'md-toc-chevron'
		// Not a tab stop: from the keyboard, ArrowLeft and ArrowRight on the entry collapse and expand.
		chevron.tabIndex = -1
		chevron.innerHTML = ICON_CHEVRON
		chevron.dataset.target = entry.id
		chevron.dataset.text = entry.text
		chevron.addEventListener('click', () => this.toggle(entry.id))
		return chevron
	}

	/** Takes a chevron's place on entries without sections, so all the text lines up. */
	createChevronSpacer(): HTMLSpanElement {
		const spacer = document.createElement('span')
		spacer.className = 'md-toc-chevron-spacer'
		return spacer
	}

	/** The button next to "Contents" that folds every section, or unfolds them all once they are. apply() gives it its icon and label. */
	createFoldAllButton(): HTMLButtonElement {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'md-toc-fold-all'
		button.addEventListener('click', () => this.toggleAll())
		return button
	}

	/** In follow mode, folds the list around the entry the highlight picked, unless it already is. */
	follow(id: string | undefined): void {
		if (!isFollowing() || id === this.followedId) return

		const { entries } = readList(document.getElementById(NAV_ID)!)
		this.followedId = id
		this.followIds = followCollapsedIds(
			entries,
			entries.findIndex(entry => entry.id === id),
		)
		this.apply()
	}

	/** Hides the entries inside collapsed sections and updates the chevrons to match. */
	apply(): void {
		// Only called once the list is built.
		const nav = document.getElementById(NAV_ID)!
		const { items, entries } = readList(nav)
		const ids = this.collapsedIds()
		const hidden = nav.classList.contains('md-toc-collapsible') ? hiddenIndices(entries, ids) : new Set<number>()

		items.forEach((item, i) => {
			item.hidden = hidden.has(i)
			const chevron = item.querySelector<HTMLButtonElement>('.md-toc-chevron')
			if (chevron) {
				const collapsed = ids.has(entries[i].id)
				chevron.setAttribute('aria-expanded', String(!collapsed))
				chevron.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + chevron.dataset.text)
				chevron.dataset.tooltip = collapsed ? 'Expand section' : 'Collapse section'
			}
		})

		updateFoldAllButton(nav, allFolded(entries, ids))
	}

	/** The collapsed sections the list shows: follow mode's own, or the saved ones. */
	private collapsedIds(): Set<string> {
		return isFollowing() ? (this.followIds ??= new Set()) : this.ids
	}

	/** Collapses or expands a section, and updates the list and the highlight. */
	private toggle(id: string): void {
		const ids = this.collapsedIds()

		if (ids.has(id)) {
			ids.delete(id)
		} else {
			ids.add(id)
		}
		this.changed()
	}

	/** Folds every section, at every level like VS Code's Collapse All, or unfolds them all when there's nothing left to fold. */
	private toggleAll(): void {
		const { entries } = readList(document.getElementById(NAV_ID)!)
		const sections = entries.filter((_, i) => hasChildren(entries, i)).map(entry => entry.id)

		this.ids = allFolded(entries, this.ids) ? new Set() : new Set(sections)
		this.changed()
	}

	/** Saves the collapsed sections, and updates the list and the highlight to match. */
	private changed(): void {
		this.save()
		this.apply()
		// The active entry may have been hidden or shown: pick it again.
		activeHighlight.reset()
		activeHighlight.update()
	}

	/** Saves the collapsed sections of the file in the preview. */
	private save(): void {
		if (!this.source) return
		// Only headings still in the document, so renamed or removed ones drop out.
		const ids = [...this.ids].filter(id => document.getElementById(id))
		const store = storeCollapsed(
			this.readStore(),
			this.source,
			ids,
			Date.now(),
			CollapsedSections.MAX_REMEMBERED_FILES,
		)
		writeStored(CollapsedSections.STORAGE_KEY, JSON.stringify(store))
	}

	/** The saved collapsed sections of every file. */
	private readStore(): CollapsedStore {
		return readStoredJson<CollapsedStore>(CollapsedSections.STORAGE_KEY, {})
	}
}

/**
 * Stores one file's collapsed sections in the store. A file with nothing collapsed is dropped, and
 * only the `max` most recently changed files are kept.
 */
export function storeCollapsed(
	store: CollapsedStore,
	source: string,
	ids: string[],
	time: number,
	max: number,
): CollapsedStore {
	const next = { ...store }
	if (ids.length > 0) {
		next[source] = { ids, time }
	} else {
		delete next[source]
	}
	return keepNewest(next, max)
}

export const collapsedSections = new CollapsedSections()
