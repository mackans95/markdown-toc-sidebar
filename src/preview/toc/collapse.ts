// Collapsed sections (markdownTocSidebar.collapsible), remembered per file.
import { readStoredJson, writeStored } from '../storage.ts';
import { resetActive, updateActive } from './active.ts';
import { NAV_ID } from './dom.ts';
import { ICON_CHEVRON } from './icons.ts';
import { hiddenIndices } from './outline.ts';

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

// The collapsed sections of the file in the preview, by heading id. Saved per file, so they're still
// collapsed after switching files, editing or reopening the preview.
let collapsedIds = new Set<string>();
// The file collapsedIds belongs to.
let collapsedSource: string | undefined;
const COLLAPSED_SECTIONS_KEY = 'md-toc-sidebar.collapsed-sections';
const MAX_REMEMBERED_FILES = 50;

// The file shown in the preview, from the data the built-in preview renders into the page. Without
// that data, reading it throws and there's no file.
function previewSource(): string | undefined {
	try {
		return JSON.parse(document.getElementById('vscode-markdown-preview-data')!.dataset.settings!).source;
	} catch {
		return undefined;
	}
}

function readCollapsedSections() {
	return readStoredJson<CollapsedStore>(COLLAPSED_SECTIONS_KEY, {});
}

// Picks up the saved sections when the preview shows a different file than before.
export function loadCollapsedIds(): void {
	const source = previewSource();
	if (source === collapsedSource) {
		return;
	}
	collapsedSource = source;
	collapsedIds = new Set((source && readCollapsedSections()[source]?.ids) || []);
}

function saveCollapsedIds() {
	if (!collapsedSource) {
		return;
	}
	// Only headings still in the document, so renamed or removed ones drop out.
	const ids = [...collapsedIds].filter(id => document.getElementById(id));
	const store = storeCollapsed(readCollapsedSections(), collapsedSource, ids, Date.now(), MAX_REMEMBERED_FILES);
	writeStored(COLLAPSED_SECTIONS_KEY, JSON.stringify(store));
}

// The button before an entry that has sections under it. A sibling of the link rather than inside
// it, so clicking it never scrolls.
export function createChevron(entry: { id: string; text: string }): HTMLButtonElement {
	const chevron = document.createElement('button');
	chevron.type = 'button';
	chevron.className = 'md-toc-chevron';
	// Not a tab stop: from the keyboard, ArrowLeft and ArrowRight on the entry collapse and expand.
	chevron.tabIndex = -1;
	chevron.innerHTML = ICON_CHEVRON;
	chevron.dataset.target = entry.id;
	chevron.dataset.text = entry.text;
	chevron.addEventListener('click', () => {
		if (collapsedIds.has(entry.id)) {
			collapsedIds.delete(entry.id);
		} else {
			collapsedIds.add(entry.id);
		}
		saveCollapsedIds();
		applyCollapsed();
		// The active entry may have been hidden or shown: pick it again.
		resetActive();
		updateActive();
	});
	return chevron;
}

// Takes a chevron's place on entries without sections, so all the text lines up.
export function createChevronSpacer(): HTMLSpanElement {
	const spacer = document.createElement('span');
	spacer.className = 'md-toc-chevron-spacer';
	return spacer;
}

// Hides the entries inside collapsed sections and updates the chevrons to match.
export function applyCollapsed(): void {
	// Only called once the list is built.
	const nav = document.getElementById(NAV_ID)!;
	const items = Array.from(nav.querySelectorAll<HTMLLIElement>('ul > li'));
	const entries = items.map(item => {
		const link = item.querySelector('a')!;
		return { id: link.dataset.target!, level: Number(link.dataset.level) };
	});
	const hidden = nav.classList.contains('md-toc-collapsible')
		? hiddenIndices(entries, collapsedIds)
		: new Set<number>();
	items.forEach((item, i) => {
		item.hidden = hidden.has(i);
		const chevron = item.querySelector<HTMLButtonElement>('.md-toc-chevron');
		if (chevron) {
			const collapsed = collapsedIds.has(entries[i].id);
			chevron.setAttribute('aria-expanded', String(!collapsed));
			chevron.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + chevron.dataset.text);
			chevron.title = collapsed ? 'Expand section' : 'Collapse section';
		}
	});
}
