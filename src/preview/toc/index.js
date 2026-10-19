// Runs inside VS Code's built-in Markdown preview webview.
// Builds a table of contents from the rendered headings and keeps it in sync.
import { CONFIG_ELEMENT_ID, SYNCED_SCROLL_EVENT } from '../../shared/constants.ts';
import { readStored, readStoredJson, writeStored } from '../storage.ts';
import { storeCollapsed } from './collapse.ts';
import { readConfig, scrollBehavior, sidebarPosition } from './config.ts';
import {
	HEADING_SELECTOR,
	keepDoubleClickInside,
	NAV_ID,
	OWN_UI_SELECTOR,
	REFRESH_BUTTON_ID,
	SETTINGS_BUTTON_ID,
	SETTINGS_MENU_ID,
	TOGGLE_ID,
} from './dom.ts';
import { assignRawHeadingIds, setDocumentHeadingMenuContexts, setHeadingMenuContext } from './headings.ts';
import {
	ICON_CHEVRON,
	ICON_CLOSE,
	ICON_HIDE_LEFT,
	ICON_HIDE_RIGHT,
	ICON_REFRESH,
	ICON_SETTINGS,
	ICON_SHOW,
} from './icons.ts';
import { isHidden, onNavKeydown, setTabStop } from './keyboard.ts';
import { ancestorIndices, buildEntries, hasChildren, hiddenIndices } from './outline.ts';
import { initResizer, updateResizerValue } from './resizer.ts';

function start() {
	function getNav() {
		let nav = document.getElementById(NAV_ID);
		if (!nav) {
			nav = document.createElement('nav');
			nav.id = NAV_ID;
			nav.setAttribute('aria-label', 'Table of contents');
			keepDoubleClickInside(nav);
			nav.addEventListener('keydown', onNavKeydown);
			// Whichever entry gets focus, by keyboard or mouse, becomes the list's tab stop.
			nav.addEventListener('focusin', event => {
				const link = event.target instanceof Element && event.target.closest('a');
				if (link) {
					setTabStop(nav, link);
				}
			});
			// Lives directly under <body>, outside .markdown-body, so preview re-renders leave it alone.
			document.body.appendChild(nav);
		}
		return nav;
	}

	const COLLAPSED_KEY = 'md-toc-sidebar.collapsed';

	function readCollapsed() {
		return readStored(COLLAPSED_KEY) === 'true';
	}

	function writeCollapsed(collapsed) {
		writeStored(COLLAPSED_KEY, String(collapsed));
	}

	function getToggle() {
		let toggle = document.getElementById(TOGGLE_ID);
		if (!toggle) {
			toggle = document.createElement('button');
			toggle.id = TOGGLE_ID;
			toggle.type = 'button';
			toggle.setAttribute('aria-controls', NAV_ID);
			keepDoubleClickInside(toggle);
			toggle.addEventListener('click', () => setCollapsed(!document.body.classList.contains('md-toc-collapsed')));
			// Sits outside the nav so it stays visible while the sidebar is hidden.
			document.body.appendChild(toggle);
		}
		return toggle;
	}

	function setCollapsed(collapsed) {
		latestActiveId = null;
		document.body.classList.toggle('md-toc-collapsed', collapsed);
		updateToggle();
		closeSettingsMenu();
		writeCollapsed(collapsed);
		if (!collapsed) {
			updateActive();
		}
	}

	function updateToggle() {
		const collapsed = document.body.classList.contains('md-toc-collapsed');
		const toggle = getToggle();
		const label = collapsed ? 'Show table of contents' : 'Hide table of contents';
		const icon = collapsed ? 'show' : sidebarPosition() === 'left' ? 'hide-left' : 'hide-right';
		// Compare by name: the browser re-serializes innerHTML, so comparing markup never matches,
		// and replacing the icon on every update would swallow clicks on the button.
		if (toggle.dataset.icon !== icon) {
			toggle.dataset.icon = icon;
			toggle.innerHTML = icon === 'show' ? ICON_SHOW : icon === 'hide-left' ? ICON_HIDE_LEFT : ICON_HIDE_RIGHT;
		}
		toggle.title = label;
		toggle.setAttribute('aria-label', label);
		toggle.setAttribute('aria-expanded', String(!collapsed));
	}

	// Settings menu behind the cog button. Its options are vscode:// links: the preview can't change
	// VS Code settings itself, so VS Code hands those links to src/extension.ts, which updates the
	// setting and refreshes the preview (which then shows the new value here).
	const SETTING_GROUPS = [
		{
			key: 'scrollBehavior',
			label: 'Scroll on click',
			options: [
				['smooth', 'Smooth'],
				['instant', 'Instant'],
			],
		},
		{
			key: 'position',
			label: 'Sidebar position',
			options: [
				['left', 'Left'],
				['right', 'Right'],
			],
		},
		{
			key: 'maxDepth',
			label: 'Show headings down to',
			options: [
				['1', 'H1'],
				['2', 'H2'],
				['3', 'H3'],
				['4', 'H4'],
				['5', 'H5'],
				['6', 'H6'],
			],
		},
		{
			key: 'topHeading',
			label: 'Single top heading',
			options: [
				['list', 'In list'],
				['title', 'As title'],
			],
		},
		{
			key: 'numbering',
			label: 'Numbering',
			options: [
				['false', 'Off'],
				['true', 'On'],
			],
		},
		{
			key: 'collapsible',
			label: 'Collapsible sections',
			options: [
				['false', 'Off'],
				['true', 'On'],
			],
		},
	];

	function initSettings() {
		const button = document.createElement('button');
		button.id = SETTINGS_BUTTON_ID;
		button.type = 'button';
		button.innerHTML = ICON_SETTINGS;
		button.title = 'Table of contents settings';
		button.setAttribute('aria-label', 'Table of contents settings');
		button.setAttribute('aria-haspopup', 'menu');
		button.setAttribute('aria-controls', SETTINGS_MENU_ID);
		button.setAttribute('aria-expanded', 'false');
		keepDoubleClickInside(button);

		const menu = document.createElement('div');
		menu.id = SETTINGS_MENU_ID;
		menu.setAttribute('role', 'menu');
		menu.setAttribute('aria-label', 'Table of contents settings');
		menu.hidden = true;
		keepDoubleClickInside(menu);

		const header = document.createElement('div');
		header.className = 'md-toc-menu-header';
		const heading = document.createElement('span');
		heading.textContent = 'Settings';
		const close = document.createElement('button');
		close.type = 'button';
		close.className = 'md-toc-menu-close';
		close.innerHTML = ICON_CLOSE;
		close.title = 'Close';
		close.setAttribute('aria-label', 'Close settings');
		close.addEventListener('click', () => {
			closeSettingsMenu();
			button.focus();
		});
		header.append(heading, close);
		menu.appendChild(header);

		for (const group of SETTING_GROUPS) {
			const label = document.createElement('div');
			label.className = 'md-toc-menu-label';
			label.textContent = group.label;
			const options = document.createElement('div');
			options.className = 'md-toc-menu-options';
			options.setAttribute('role', 'group');
			options.setAttribute('aria-label', group.label);
			for (const [value, text] of group.options) {
				const option = document.createElement('a');
				option.className = 'md-toc-menu-option';
				option.setAttribute('role', 'menuitemradio');
				option.dataset.key = group.key;
				option.dataset.value = value;
				option.textContent = text;
				options.appendChild(option);
			}
			menu.append(label, options);
		}
		const allSettings = document.createElement('a');
		allSettings.className = 'md-toc-menu-link';
		allSettings.setAttribute('role', 'menuitem');
		allSettings.dataset.path = '/open-settings';
		allSettings.textContent = 'Open all settings…';
		menu.appendChild(allSettings);

		document.body.append(button, menu);

		button.addEventListener('click', event => {
			if (menu.hidden) {
				openSettingsMenu(event.detail === 0);
			} else {
				closeSettingsMenu();
			}
		});
		// Picking an option applies it right away, here and in other open previews; the link itself
		// then goes to VS Code (via src/extension.ts) to save the setting. The menu stays open.
		menu.addEventListener('click', event => {
			const option = event.target instanceof Element && event.target.closest('.md-toc-menu-option');
			if (!option) {
				return;
			}
			if (option.getAttribute('aria-checked') === 'true') {
				// Already the current value: nothing to save.
				event.preventDefault();
				return;
			}
			applySettingLocally(option.dataset.key, option.dataset.value);
			broadcastSetting(option.dataset.key, option.dataset.value);
		});
		document.addEventListener(
			'pointerdown',
			event => {
				if (
					!menu.hidden &&
					event.target instanceof Node &&
					!menu.contains(event.target) &&
					!button.contains(event.target)
				) {
					closeSettingsMenu();
				}
			},
			true,
		);
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape' && !menu.hidden) {
				closeSettingsMenu();
				button.focus();
			}
		});
	}

	// Refresh button next to the cog. Like the settings menu it's a vscode:// link: src/extension.ts
	// runs the built-in "Markdown: Refresh Preview", which re-renders all previews from the source.
	function initRefresh() {
		const button = document.createElement('a');
		button.id = REFRESH_BUTTON_ID;
		button.setAttribute('role', 'button');
		button.innerHTML = ICON_REFRESH;
		button.title = 'Refresh preview';
		button.setAttribute('aria-label', 'Refresh preview');
		keepDoubleClickInside(button);
		document.body.appendChild(button);
	}

	function openSettingsMenu(fromKeyboard) {
		const menu = document.getElementById(SETTINGS_MENU_ID);
		menu.hidden = false;
		document.getElementById(SETTINGS_BUTTON_ID).setAttribute('aria-expanded', 'true');
		if (fromKeyboard) {
			menu.querySelector('[aria-checked="true"]')?.focus();
		}
	}

	function closeSettingsMenu() {
		const menu = document.getElementById(SETTINGS_MENU_ID);
		if (menu && !menu.hidden) {
			menu.hidden = true;
			document.getElementById(SETTINGS_BUTTON_ID).setAttribute('aria-expanded', 'false');
		}
	}

	// Other open previews share this page's storage, so a key written here reaches them as a
	// 'storage' event. That lets a choice from the menu show up everywhere without a reload.
	const LIVE_SETTING_KEY = 'md-toc-sidebar.live-setting';

	function applySettingLocally(key, value) {
		const config = document.getElementById(CONFIG_ELEMENT_ID);
		if (config) {
			config.dataset[key] = value;
			scheduleBuild();
		}
	}

	function broadcastSetting(key, value) {
		// The timestamp makes every write a change, so repeated choices still fire the event.
		writeStored(LIVE_SETTING_KEY, JSON.stringify({ key, value, time: Date.now() }));
	}

	window.addEventListener('storage', event => {
		if (event.key !== LIVE_SETTING_KEY || !event.newValue) {
			return;
		}
		try {
			const { key, value } = JSON.parse(event.newValue);
			if (SETTING_GROUPS.some(group => group.key === key && group.options.some(([v]) => v === value))) {
				applySettingLocally(key, value);
			}
		} catch {
			// Ignore malformed values.
		}
	});

	// Applies the settings from the config element: sidebar side, toggle icon and the menu's links.
	function applyConfig() {
		const config = document.getElementById(CONFIG_ELEMENT_ID);
		// Without the config element (src/extension.ts not active), settings can't be changed from here.
		document.body.classList.toggle('md-toc-configurable', !!(config && config.dataset.uriBase));
		document.body.classList.toggle('md-toc-left', sidebarPosition() === 'left');
		updateToggle();

		const menu = document.getElementById(SETTINGS_MENU_ID);
		if (!menu || !config) {
			return;
		}
		const uriBase = config.dataset.uriBase || '';
		document.getElementById(REFRESH_BUTTON_ID)?.setAttribute('href', uriBase + '/refresh');
		for (const option of menu.querySelectorAll('.md-toc-menu-option')) {
			const { key, value } = option.dataset;
			const href = uriBase + '/set?' + new URLSearchParams({ [key]: value });
			if (option.getAttribute('href') !== href) {
				option.setAttribute('href', href);
			}
			option.setAttribute('aria-checked', String(readConfig(key, '') === value));
		}
		const allSettings = menu.querySelector('.md-toc-menu-link');
		allSettings.setAttribute('href', uriBase + allSettings.dataset.path);
	}

	function buildToc() {
		latestActiveId = null;
		const headings = Array.from(document.querySelectorAll(HEADING_SELECTOR));
		const nav = getNav();

		if (headings.length === 0) {
			tocIds = new Set();
			nav.replaceChildren();
			document.body.classList.remove('md-toc-visible');
			return;
		}

		const maxDepth = Number(readConfig('maxDepth', '6'));
		const topHeading = readConfig('topHeading', 'list');
		const numbering = readConfig('numbering', 'false') === 'true';
		const entries = buildEntries(
			headings.map(h => ({ id: h.id, text: h.textContent.trim(), level: Number(h.tagName[1]) })),
			{ maxDepth, topHeading, numbering },
		);
		tocIds = new Set(entries.map(entry => entry.id));

		const createLink = entry => {
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
		};

		const collapsible = readConfig('collapsible', 'false') === 'true';
		const listEntries = entries.filter(entry => !entry.isTitle);
		const list = document.createElement('ul');
		listEntries.forEach((entry, i) => {
			const item = document.createElement('li');
			item.style.setProperty('--md-toc-depth', String(entry.depth));
			if (collapsible) {
				item.appendChild(hasChildren(listEntries, i) ? createChevron(entry) : createChevronSpacer());
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
		loadCollapsedIds();
		applyCollapsed();
		updateResizerValue();
		updateActive();
	}

	// Collapsed sections (markdownTocSidebar.collapsible) of the file in the preview, by heading id.
	// Saved per file, so they're still collapsed after switching files, editing or reopening the preview.
	let collapsedIds = new Set();
	// The file collapsedIds belongs to.
	let collapsedSource;
	const COLLAPSED_SECTIONS_KEY = 'md-toc-sidebar.collapsed-sections';
	const MAX_REMEMBERED_FILES = 50;

	// The file shown in the preview, from the data the built-in preview renders into the page.
	function previewSource() {
		try {
			return JSON.parse(document.getElementById('vscode-markdown-preview-data').dataset.settings).source;
		} catch {
			return undefined;
		}
	}

	function readCollapsedSections() {
		return readStoredJson(COLLAPSED_SECTIONS_KEY, {});
	}

	// Picks up the saved sections when the preview shows a different file than before.
	function loadCollapsedIds() {
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
	function createChevron(entry) {
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
			latestActiveId = null;
			updateActive();
		});
		return chevron;
	}

	// Takes a chevron's place on entries without sections, so all the text lines up.
	function createChevronSpacer() {
		const spacer = document.createElement('span');
		spacer.className = 'md-toc-chevron-spacer';
		return spacer;
	}

	// Hides the entries inside collapsed sections and updates the chevrons to match.
	function applyCollapsed() {
		const nav = document.getElementById(NAV_ID);
		const items = Array.from(nav.querySelectorAll('ul > li'));
		const entries = items.map(item => {
			const link = item.querySelector('a');
			return { id: link.dataset.target, level: Number(link.dataset.level) };
		});
		const hidden = nav.classList.contains('md-toc-collapsible') ? hiddenIndices(entries, collapsedIds) : new Set();
		items.forEach((item, i) => {
			item.hidden = hidden.has(i);
			const chevron = item.querySelector('.md-toc-chevron');
			if (chevron) {
				const collapsed = collapsedIds.has(entries[i].id);
				chevron.setAttribute('aria-expanded', String(!collapsed));
				chevron.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + chevron.dataset.text);
				chevron.title = collapsed ? 'Expand section' : 'Collapse section';
			}
		});
	}

	// While a TOC click's scroll is in flight, keep the clicked entry highlighted instead of
	// recomputing from scroll position (short sections or the end of the page would pick another).
	let pinnedId = null;
	// Heading to flash once the scroll arrives, so a smooth scroll doesn't fade it before it's in view.
	let pinnedHeading = null;
	let settleTimer = 0;
	// How long the page has to be still before a click's scroll counts as finished. Covers clicks
	// that don't scroll at all, where no scrollend event fires.
	const SETTLE_MS = 150;

	function pinActive(heading) {
		pinnedId = heading.id;
		pinnedHeading = heading;
		restartSettleTimer();
	}

	function restartSettleTimer() {
		clearTimeout(settleTimer);
		settleTimer = setTimeout(settle, SETTLE_MS);
	}

	function settle() {
		clearTimeout(settleTimer);
		if (!pinnedId) {
			return;
		}
		// Drop any recompute queued by the scroll so it can't override the clicked entry.
		cancelAnimationFrame(scrollFrame);
		scrollFrame = 0;
		const heading = pinnedHeading;
		pinnedId = null;
		pinnedHeading = null;
		if (heading && heading.isConnected) {
			flashHeading(heading);
		}
	}

	function findActiveHeading(headings) {
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

	// Ids of the headings listed in the sidebar; headings deeper than maxDepth aren't in it.
	let tocIds = new Set();

	// Contains the entry that was last highlighted, so we don't update the DOM unnecessarily.
	let latestActiveId = null;

	function setActiveLink(id) {
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

	// Briefly highlights a heading after jumping to it, so it's easy to see where you landed.
	function flashHeading(heading) {
		heading.classList.remove('md-toc-flash');
		// Force a reflow so the animation restarts when the same heading is clicked again.
		void heading.offsetWidth;
		heading.classList.add('md-toc-flash');
		heading.addEventListener('animationend', () => heading.classList.remove('md-toc-flash'), { once: true });
	}

	function updateActive() {
		if (pinnedId) {
			setActiveLink(pinnedId);
			return;
		}
		// Only listed headings: inside a section deeper than maxDepth, its listed parent is the active one.
		const listed = Array.from(document.querySelectorAll(HEADING_SELECTOR)).filter(h => tocIds.has(h.id));
		const active = findActiveHeading(listed);
		setActiveLink(active?.id);
	}

	// Handle clicks ourselves so the preview's own link handler doesn't interfere.
	document.addEventListener(
		'click',
		event => {
			const link = event.target instanceof Element && event.target.closest('#' + NAV_ID + ' a');
			if (!link) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const target = document.getElementById(link.dataset.target);
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

	// Where the page has to scroll for a heading to sit at the top, honoring its scroll-margin-top.
	function headingScrollTop(heading) {
		const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
		const top = window.scrollY + heading.getBoundingClientRect().top - margin;
		const max = document.documentElement.scrollHeight - window.innerHeight;
		return Math.min(Math.max(0, top), Math.max(0, max));
	}

	// Our own animation rather than scrollIntoView's smooth behavior: the browser's takes up to
	// ~1.5s for long jumps, which feels sluggish for navigation. This one stays within 250-600ms.
	let scrollAnimation = 0;

	function animateScrollTo(top) {
		stopScrollAnimation();
		const start = window.scrollY;
		const distance = top - start;
		if (Math.abs(distance) < 1) {
			return;
		}
		const duration = Math.min(600, Math.max(250, Math.abs(distance) * 0.15));
		const startTime = performance.now();
		const step = now => {
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

	function stopScrollAnimation() {
		cancelAnimationFrame(scrollAnimation);
		scrollAnimation = 0;
	}

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

	let scrollFrame = 0;
	function onScroll() {
		if (pinnedId) {
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
	window.addEventListener('scroll', onScroll, { passive: true });
	// smooth-scroll-sync hides its gliding scroll events from regular listeners and fires this instead.
	window.addEventListener(SYNCED_SCROLL_EVENT, onScroll);

	// Rebuild at most once per frame, and only when the headings or the settings changed.
	let lastSignature = '';
	let buildFrame = 0;
	function scheduleBuild() {
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

	// Our script loads async, so the preview content may arrive before or after we run.
	// Watching the DOM catches the initial render and every later update regardless of timing.
	// Changes inside our own UI (sidebar, buttons, menu) are ignored, or updating it would loop.
	new MutationObserver(records => {
		const isOwnUi = node => (node instanceof Element ? node : node.parentElement)?.closest(OWN_UI_SELECTOR);
		if (records.some(r => !isOwnUi(r.target))) {
			scheduleBuild();
		}
	}).observe(document.body, { childList: true, subtree: true, characterData: true });

	// Fired by the built-in preview after it patches in new content.
	window.addEventListener('vscode.markdown.updateContent', scheduleBuild);

	initResizer();
	initSettings();
	initRefresh();
	setCollapsed(readCollapsed());
	scheduleBuild();
}

// Protects the script from running twice on the same page, no double initialization.
if (!window.__mdTocSidebarInitialized) {
	window.__mdTocSidebarInitialized = true;
	start();
}
