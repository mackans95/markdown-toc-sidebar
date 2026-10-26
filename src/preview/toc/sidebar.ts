// The sidebar itself: the list of entries, rebuilt whenever the headings or the settings change.
import { CONFIG_ELEMENT_ID } from '../../shared/constants.ts';
import { resetActive, setTocIds, updateActive } from './active.ts';
import { collapsedSections } from './collapse.ts';
import { readConfig, sidebarPosition } from './config.ts';
import { HEADING_SELECTOR, keepDoubleClickInside, NAV_ID } from './dom.ts';
import { assignRawHeadingIds, setDocumentHeadingMenuContexts, setHeadingMenuContext } from './headings.ts';
import { onNavKeydown, setTabStop } from './keyboard.ts';
import { buildEntries, hasChildren } from './outline.ts';
import { updateResizerValue } from './resizer.ts';
import { updateSettingsMenu } from './settings-menu.ts';
import { updateToggle } from './toggle.ts';
import type { Entry } from '../../types/preview.ts';

// Rebuild at most once per frame, and only when the headings or the settings changed.
let lastSignature = '';
let buildFrame = 0;

/** The sidebar's nav element, created with its keyboard handling the first time. */
function getNav() {
	let nav = document.getElementById(NAV_ID);
	if (!nav) {
		const created = document.createElement('nav');
		created.id = NAV_ID;
		created.setAttribute('aria-label', 'Table of contents');
		keepDoubleClickInside(created);
		created.addEventListener('keydown', onNavKeydown);
		// Whichever entry gets focus, by keyboard or mouse, becomes the list's tab stop.
		created.addEventListener('focusin', event => {
			const link = event.target instanceof Element && event.target.closest('a');
			if (link) {
				setTabStop(created, link);
			}
		});
		// Lives directly under <body>, outside .markdown-body, so preview re-renders leave it alone.
		document.body.appendChild(created);
		nav = created;
	}
	return nav;
}

/** Applies the settings from the config element: sidebar side, toggle icon and the menu's links. */
function applyConfig() {
	const config = document.getElementById(CONFIG_ELEMENT_ID);
	// Without the config element (src/extension.ts not active), settings can't be changed from here.
	document.body.classList.toggle('md-toc-configurable', !!(config && config.dataset.uriBase));
	document.body.classList.toggle('md-toc-left', sidebarPosition() === 'left');
	updateToggle();
	updateSettingsMenu();
}

/** The link for one entry, with its number when numbering is on. */
function createLink(entry: Entry) {
	const link = document.createElement('a');
	link.href = '#' + entry.id;
	link.textContent = entry.text;
	link.dataset.target = entry.id;
	link.dataset.level = String(entry.level);
	link.title = entry.text;
	// setActiveLink makes one entry the tab stop; the arrow keys move between them.
	link.tabIndex = -1;
	setHeadingMenuContext(link, entry.id, entry.text, true);
	if (entry.number) {
		const number = document.createElement('span');
		number.className = 'md-toc-number';
		number.textContent = entry.number;
		link.prepend(number);
	}
	return link;
}

/** Rebuilds the list from the document's headings and the current settings. */
function buildToc() {
	resetActive();
	const headings = Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
	const nav = getNav();

	if (headings.length === 0) {
		setTocIds(new Set());
		nav.replaceChildren();
		document.body.classList.remove('md-toc-visible');
		return;
	}

	const maxDepth = Number(readConfig('maxDepth', '6'));
	const topHeading = readConfig('topHeading', 'list') === 'title' ? 'title' : 'list';
	const numbering = readConfig('numbering', 'false') === 'true';
	const entries = buildEntries(
		headings.map(h => ({ id: h.id, text: h.textContent.trim(), level: Number(h.tagName[1]) })),
		{ maxDepth, topHeading, numbering },
	);
	setTocIds(new Set(entries.map(entry => entry.id)));

	const collapsible = readConfig('collapsible', 'false') === 'true';
	const listEntries = entries.filter(entry => !entry.isTitle);
	const list = document.createElement('ul');
	listEntries.forEach((entry, i) => {
		const item = document.createElement('li');
		item.style.setProperty('--md-toc-depth', String(entry.depth));
		if (collapsible) {
			item.appendChild(
				hasChildren(listEntries, i)
					? collapsedSections.createChevron(entry)
					: collapsedSections.createChevronSpacer(),
			);
		}
		item.appendChild(createLink(entry));
		list.appendChild(item);
	});
	nav.classList.toggle('md-toc-collapsible', collapsible);

	// Pinned while the list scrolls: the "Contents" row next to the header buttons, and the
	// document's title below it when topHeading is 'title'.
	const header = document.createElement('div');
	header.className = 'md-toc-header';
	const title = document.createElement('div');
	title.className = 'md-toc-title';
	title.textContent = 'Contents';
	header.appendChild(title);
	const titleEntry = entries.find(entry => entry.isTitle);
	if (titleEntry) {
		const docTitle = createLink(titleEntry);
		docTitle.className = 'md-toc-doc-title';
		header.appendChild(docTitle);
	}
	nav.classList.toggle('md-toc-has-doc-title', !!titleEntry);

	nav.replaceChildren(header, list);
	document.body.classList.add('md-toc-visible');
	collapsedSections.load();
	collapsedSections.apply();
	updateResizerValue();
	updateActive();
}

/** Rebuilds the sidebar on the next frame if the headings or the settings changed; calls within one frame share a rebuild. */
export function scheduleBuild(): void {
	if (buildFrame) {
		return;
	}
	buildFrame = requestAnimationFrame(() => {
		buildFrame = 0;
		applyConfig();
		assignRawHeadingIds();
		setDocumentHeadingMenuContexts();
		const config = document.getElementById(CONFIG_ELEMENT_ID);
		const settings = config ? JSON.stringify(config.dataset) : '';
		const signature =
			settings +
			'\n' +
			Array.from(document.querySelectorAll(HEADING_SELECTOR))
				.map(h => h.tagName + '#' + h.id + ':' + h.textContent)
				.join('\n');
		if (signature !== lastSignature || !document.getElementById(NAV_ID)) {
			lastSignature = signature;
			buildToc();
		}
	});
}
