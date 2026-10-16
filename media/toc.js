// Runs inside VS Code's built-in Markdown preview webview.
// Builds a table of contents from the rendered headings and keeps it in sync.
(function () {
	const NAV_ID = 'md-toc-sidebar';
	const TOGGLE_ID = 'md-toc-toggle';
	const RESIZER_ID = 'md-toc-resizer';
	const SETTINGS_BUTTON_ID = 'md-toc-settings-button';
	const SETTINGS_MENU_ID = 'md-toc-settings-menu';
	const REFRESH_BUTTON_ID = 'md-toc-refresh-button';
	const HEADING_SELECTOR = '.markdown-body :is(h1, h2, h3, h4, h5, h6)[id]';

	// Pure functions, no DOM, tested in test/toc.test.js.
	/**
	 * @param {{ id: string, text: string, level: number}[]} headings
	 * @param {{ maxDepth?: number, topHeading?: 'list' | 'title', numbering?: boolean }} options
	 *   maxDepth: deepest heading level to list (1-6). topHeading: 'title' marks a lone top heading
	 *   with isTitle. numbering: gives every entry but the title a number like '2.1'.
	 */
	function buildEntries(headings, options = {}) {
		const maxDepth = options.maxDepth ?? 6;
		const topHeading = options.topHeading ?? 'list';
		const baseLevel = Math.min(...headings.map(h => h.level));
		// Never hide the document's top level: an empty list would hide the sidebar, and with it the
		// settings menu needed to change maxDepth back.
		const limit = Math.max(maxDepth, baseLevel);

		// A title only when the first heading is the only one at the top level, like a `#` above `##` sections.
		const hasTitle = topHeading === 'title'
			&& headings.length > 0
			&& headings[0].level === baseLevel
			&& headings.filter(h => h.level === baseLevel).length === 1;
		// The rest is indented from its own top level, so `#` followed by `###` sections doesn't leave a gap.
		const rest = hasTitle ? headings.slice(1) : headings;
		const listBase = Math.min(...rest.map(h => h.level));

		const entries = headings.map((h, i) => {
			if (hasTitle && i === 0) {
				return { ...h, depth: 0, isTitle: true };
			}
			return { ...h, depth: h.level - listBase };
		}).filter(h => h.level <= limit);

		if (options.numbering) {
			addNumbers(entries.filter(entry => !entry.isTitle));
		}
		return entries;
	}

	// Numbers entries by their place in the outline: an entry's parent is the closest earlier one
	// with a lower level, the same rule ancestorIndices uses. A skipped level (## then ####) doesn't
	// add a 0, and a heading that comes back up past a deeper one (#### then ###) continues its count.
	function addNumbers(entries) {
		// The open sections from the outermost in, with how many entries each level has had so far.
		const stack = [];
		for (const entry of entries) {
			let closed;
			while (stack.length > 0 && stack[stack.length - 1].level > entry.level) {
				closed = stack.pop();
			}
			const top = stack[stack.length - 1];
			if (top && top.level === entry.level) {
				top.count++;
			} else {
				// A new level here; if a deeper one was just closed, this entry is its next sibling.
				stack.push({ level: entry.level, count: closed ? closed.count + 1 : 1 });
			}
			entry.number = stack.map(section => section.count).join('.');
		}
	}

	// The sections containing the active one: walking back up the list, each entry with a
	// lower level than the last one found is the next enclosing section.
	function ancestorIndices(entries, index) {
		const ancestors = new Set();
		if (index >= 0) {
			let level = entries[index].level;

			for (let i = index - 1; i >= 0 && level > 1; i--) {
				const entryLevel = entries[i].level;
				if (entryLevel < level) {
					ancestors.add(i);
					level = entryLevel;
				}
			}
		}

		return ancestors;
	}

	// Whether an entry has sections under it: the next entry is deeper. Same rule as ancestorIndices,
	// so a skipped level (## then ####) still counts as a child.
	function hasChildren(entries, index) {
		return index + 1 < entries.length && entries[index + 1].level > entries[index].level;
	}

	// The entries hidden by collapsed sections: everything after a collapsed entry that is deeper than
	// it, up to the next entry at its level or above. A collapsed section inside a hidden one changes
	// nothing, and a collapsed entry without children hides nothing.
	function hiddenIndices(entries, collapsedIds) {
		const hidden = new Set();
		let collapsedLevel = null;
		entries.forEach((entry, i) => {
			if (collapsedLevel !== null && entry.level > collapsedLevel) {
				hidden.add(i);
				return;
			}
			collapsedLevel = collapsedIds.has(entry.id) ? entry.level : null;
		});
		return hidden;
	}

	// Where a key moves focus in the list: the index of the entry to focus, the same index when there's
	// nowhere to go, or undefined for keys the list doesn't use. Entries hidden in collapsed sections
	// are skipped. ArrowRight goes to the first child and ArrowLeft to the parent; expanding and
	// collapsing with those keys is handled before this.
	function focusTarget(entries, index, key) {
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

	// Stores one file's collapsed sections in a map of { [file]: { ids, time } }. A file with nothing
	// collapsed is dropped, and only the `max` most recently changed files are kept.
	function storeCollapsed(store, source, ids, time, max) {
		const next = { ...store };
		if (ids.length > 0) {
			next[source] = { ids, time };
		} else {
			delete next[source];
		}
		const newest = Object.entries(next).sort((a, b) => b[1].time - a[1].time).slice(0, max);
		return Object.fromEntries(newest);
	}

	// What the context menu's copy commands put on the clipboard: the heading's anchor, and a Markdown
	// link to it. Brackets and backslashes in the text are escaped so they don't end the link text.
	function headingLinks(id, text) {
		const link = '#' + id;
		return { link, markdownLink: `[${text.replace(/[\\[\]]/g, '\\$&')}](${link})` };
	}

	// Means we are in Node, export and stop here.
	if (typeof module === 'object' && module.exports) {
		module.exports = { buildEntries, ancestorIndices, hasChildren, hiddenIndices, focusTarget, storeCollapsed, headingLinks };
		return;
	}

	// Protects the script from running twice on the same page, no double initialization.
	if (window.__mdTocSidebarInitialized) {
		return;
	}
	window.__mdTocSidebarInitialized = true;

	// Written into every rendered preview by src/extension.js, which can read VS Code settings.
	const CONFIG_ID = 'md-toc-sidebar-config';
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	// Current value of a setting, or the fallback when the config element isn't there (yet).
	function readConfig(key, fallback) {
		const config = document.getElementById(CONFIG_ID);
		return (config && config.dataset[key]) || fallback;
	}

	// 'smooth' or 'instant', from the markdownTocSidebar.scrollBehavior setting.
	function scrollBehavior() {
		if (reducedMotion.matches) {
			return 'instant';
		}
		return readConfig('scrollBehavior', 'smooth') === 'instant' ? 'instant' : 'smooth';
	}

	// 'left' or 'right', from the markdownTocSidebar.position setting.
	function sidebarPosition() {
		return readConfig('position', 'right') === 'left' ? 'left' : 'right';
	}

	// A double-click in the preview can jump to the editor; our UI shouldn't trigger that.
	// Stopping it on the element itself (not at the document) still lets the element's own
	// dblclick handlers run first.
	function keepDoubleClickInside(element) {
		element.addEventListener('dblclick', event => event.stopPropagation());
	}

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
	// The hide arrow points towards the edge the sidebar collapses into.
	const ICON_HIDE_RIGHT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
	const ICON_HIDE_LEFT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
	const ICON_SHOW = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

	function readCollapsed() {
		try {
			return localStorage.getItem(COLLAPSED_KEY) === 'true';
		} catch {
			return false;
		}
	}

	function writeCollapsed(collapsed) {
		try {
			localStorage.setItem(COLLAPSED_KEY, String(collapsed));
		} catch {
			// Storage unavailable; the state just won't persist.
		}
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
	// VS Code settings itself, so VS Code hands those links to src/extension.js, which updates the
	// setting and refreshes the preview (which then shows the new value here).
	const ICON_CLOSE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
	const ICON_SETTINGS = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="2.2 2.2"/><circle cx="8" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
	const SETTING_GROUPS = [
		{ key: 'scrollBehavior', label: 'Scroll on click', options: [['smooth', 'Smooth'], ['instant', 'Instant']] },
		{ key: 'position', label: 'Sidebar position', options: [['left', 'Left'], ['right', 'Right']] },
		{ key: 'maxDepth', label: 'Show headings down to', options: [['1', 'H1'], ['2', 'H2'], ['3', 'H3'], ['4', 'H4'], ['5', 'H5'], ['6', 'H6']] },
		{ key: 'topHeading', label: 'Single top heading', options: [['list', 'In list'], ['title', 'As title']] },
		{ key: 'numbering', label: 'Numbering', options: [['false', 'Off'], ['true', 'On']] },
		{ key: 'collapsible', label: 'Collapsible sections', options: [['false', 'Off'], ['true', 'On']] },
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
		// then goes to VS Code (via src/extension.js) to save the setting. The menu stays open.
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
		document.addEventListener('pointerdown', event => {
			if (!menu.hidden && event.target instanceof Node && !menu.contains(event.target) && !button.contains(event.target)) {
				closeSettingsMenu();
			}
		}, true);
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape' && !menu.hidden) {
				closeSettingsMenu();
				button.focus();
			}
		});
	}

	// Refresh button next to the cog. Like the settings menu it's a vscode:// link: src/extension.js
	// runs the built-in "Markdown: Refresh Preview", which re-renders all previews from the source.
	const ICON_REFRESH = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.46-3.54" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12.5 1.5v3.5H9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

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
		const config = document.getElementById(CONFIG_ID);
		if (config) {
			config.dataset[key] = value;
			scheduleBuild();
		}
	}

	function broadcastSetting(key, value) {
		try {
			// The timestamp makes every write a change, so repeated choices still fire the event.
			localStorage.setItem(LIVE_SETTING_KEY, JSON.stringify({ key, value, time: Date.now() }));
		} catch {
			// Storage unavailable; other previews update when they next re-render.
		}
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
		const config = document.getElementById(CONFIG_ID);
		// Without the config element (src/extension.js not active), settings can't be changed from here.
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

	const WIDTH_KEY = 'md-toc-sidebar.width';
	const MIN_WIDTH = 140;
	// Always leave at least this much room for the document itself.
	const MIN_CONTENT_WIDTH = 240;
	const KEYBOARD_STEP = 16;

	function readWidth() {
		try {
			const width = Number(localStorage.getItem(WIDTH_KEY));
			return width > 0 ? width : undefined;
		} catch {
			return undefined;
		}
	}

	function writeWidth(width) {
		try {
			if (width === undefined) {
				localStorage.removeItem(WIDTH_KEY);
			} else {
				localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
			}
		} catch {
			// Storage unavailable; the width just won't persist.
		}
	}

	// Width of the area fixed elements are laid out in: excludes the preview's own scrollbar.
	function viewportWidth() {
		return document.documentElement.clientWidth;
	}

	function clampWidth(width) {
		const max = Math.max(MIN_WIDTH, viewportWidth() - MIN_CONTENT_WIDTH);
		return Math.min(Math.max(width, MIN_WIDTH), max);
	}

	// A user-chosen width overrides the responsive default from toc.css; undefined restores it.
	// The stored value is kept unclamped so a narrow window doesn't permanently shrink it.
	function applyWidth(width) {
		const root = document.documentElement;
		if (width === undefined) {
			root.style.removeProperty('--md-toc-width');
		} else {
			root.style.setProperty('--md-toc-width', clampWidth(width) + 'px');
		}
		updateResizerValue();
	}

	function updateResizerValue() {
		const resizer = document.getElementById(RESIZER_ID);
		const nav = document.getElementById(NAV_ID);
		if (resizer && nav) {
			resizer.setAttribute('aria-valuenow', String(Math.round(nav.getBoundingClientRect().width)));
		}
	}

	function initResizer() {
		const resizer = document.createElement('div');
		resizer.id = RESIZER_ID;
		resizer.tabIndex = 0;
		resizer.setAttribute('role', 'separator');
		resizer.setAttribute('aria-orientation', 'vertical');
		resizer.setAttribute('aria-controls', NAV_ID);
		resizer.setAttribute('aria-label', 'Resize table of contents');
		resizer.setAttribute('aria-valuemin', String(MIN_WIDTH));
		resizer.title = 'Drag to resize, double-click to reset';
		keepDoubleClickInside(resizer);
		document.body.appendChild(resizer);

		const currentWidth = () => document.getElementById(NAV_ID).getBoundingClientRect().width;
		let dragWidth;

		resizer.addEventListener('pointerdown', event => {
			if (event.button !== 0) {
				return;
			}
			// No preventDefault here: it would also suppress the dblclick used to reset the width.
			// Text selection during the drag is prevented by the md-toc-resizing class instead.
			resizer.setPointerCapture(event.pointerId);
			document.body.classList.add('md-toc-resizing');
			dragWidth = currentWidth();
		});

		resizer.addEventListener('pointermove', event => {
			if (!resizer.hasPointerCapture(event.pointerId)) {
				return;
			}
			// The sidebar is pinned to one edge, so its width is the pointer's distance from that edge.
			const distance = sidebarPosition() === 'left' ? event.clientX : viewportWidth() - event.clientX;
			dragWidth = clampWidth(distance);
			applyWidth(dragWidth);
		});

		const endDrag = event => {
			if (!resizer.hasPointerCapture(event.pointerId)) {
				return;
			}
			resizer.releasePointerCapture(event.pointerId);
			document.body.classList.remove('md-toc-resizing');
			writeWidth(dragWidth);
		};
		resizer.addEventListener('pointerup', endDrag);
		resizer.addEventListener('pointercancel', endDrag);

		resizer.addEventListener('dblclick', () => {
			writeWidth(undefined);
			applyWidth(undefined);
		});

		resizer.addEventListener('keydown', event => {
			// Moving the handle away from the sidebar's edge widens it.
			const outward = sidebarPosition() === 'left' ? 'ArrowRight' : 'ArrowLeft';
			const inward = sidebarPosition() === 'left' ? 'ArrowLeft' : 'ArrowRight';
			const delta = event.key === outward ? KEYBOARD_STEP : event.key === inward ? -KEYBOARD_STEP : 0;
			if (!delta) {
				return;
			}
			event.preventDefault();
			const width = clampWidth(currentWidth() + delta);
			applyWidth(width);
			writeWidth(width);
		});

		// Re-clamp the stored width when the preview pane itself is resized.
		window.addEventListener('resize', () => applyWidth(readWidth()));
		applyWidth(readWidth());
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
		const entries = buildEntries(headings.map(h => ({ id: h.id, text: h.textContent.trim(), level: Number(h.tagName[1]) })), { maxDepth, topHeading, numbering });
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
		try {
			return JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_KEY)) || {};
		} catch {
			return {};
		}
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
		try {
			const store = storeCollapsed(readCollapsedSections(), collapsedSource, ids, Date.now(), MAX_REMEMBERED_FILES);
			localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(store));
		} catch {
			// Storage unavailable; the sections stay collapsed until the preview reloads.
		}
	}

	const ICON_CHEVRON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

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

		const ancestors = ancestorIndices(links.map(l => ({ level: Number(l.dataset.level) })), activeIndex);
		// Inside a collapsed section the active entry is hidden; show its closest visible parent as active
		// instead. The ancestors come closest first.
		const isHidden = link => !!link.closest('li')?.hidden;
		const shownIndex = activeIndex >= 0 && isHidden(links[activeIndex])
			? [...ancestors].find(i => !isHidden(links[i])) ?? -1
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
			link.classList.toggle('active-ancestor', ancestors.has(i) && i < shownIndex && !link.classList.contains('md-toc-doc-title'));
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

	// The whole list is a single tab stop (the arrow keys move within it), so Tab gets past it in one go.
	function setTabStop(nav, stop) {
		for (const link of nav.querySelectorAll('a')) {
			link.tabIndex = link === stop ? 0 : -1;
		}
	}

	// Arrow keys, Home and End move between the visible entries. On an entry with sections under it,
	// ArrowRight expands and ArrowLeft collapses (markdownTocSidebar.collapsible) before moving.
	function onNavKeydown(event) {
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof Element)) {
			return;
		}
		const nav = event.currentTarget;
		// A chevron focused by a click stands in for its entry.
		const current = event.target.closest('a') ?? event.target.closest('li')?.querySelector('a');
		const links = Array.from(nav.querySelectorAll('a'));
		const index = links.indexOf(current);
		if (index < 0) {
			return;
		}

		const chevron = current.closest('li')?.querySelector('.md-toc-chevron');
		const expanded = chevron?.getAttribute('aria-expanded');
		if ((event.key === 'ArrowRight' && expanded === 'false') || (event.key === 'ArrowLeft' && expanded === 'true')) {
			event.preventDefault();
			event.stopPropagation();
			chevron.click();
			current.focus();
			return;
		}

		const isHidden = link => !!link.closest('li')?.hidden;
		const entries = links.map(link => ({ level: Number(link.dataset.level), hidden: isHidden(link) }));
		const target = focusTarget(entries, index, event.key);
		if (target === undefined) {
			return;
		}
		// Also at the ends of the list, so the keys don't scroll the page instead.
		event.preventDefault();
		event.stopPropagation();
		if (target !== index) {
			links[target].focus();
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
	document.addEventListener('click', event => {
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
	}, true);

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
	// smooth-scroll-sync.js hides its gliding scroll events from regular listeners and fires this instead.
	window.addEventListener('md-toc-sidebar:synced-scroll', onScroll);

	// Prefix for ids we give headings written as HTML. They only exist in the preview, so a link to
	// one wouldn't work anywhere else.
	const RAW_ID_PREFIX = 'md-toc-raw-';

	// Headings written as HTML (<h2>…</h2>) get no id from the preview, so nothing could link to them.
	// Runs before every build: if the preview replaces such a heading while updating, the id is gone,
	// and the update's own rebuild puts it back. Setting an attribute doesn't trigger the observer below.
	function assignRawHeadingIds() {
		let n = 0;
		for (const heading of document.querySelectorAll('.markdown-body :is(h1, h2, h3, h4, h5, h6):not([id])')) {
			let id;
			do {
				id = RAW_ID_PREFIX + ++n;
			} while (document.getElementById(id));
			heading.id = id;
		}
	}

	// Right-clicking a heading, in the sidebar or the document, offers to copy a link to it: VS Code
	// shows the "webview/context" menu items from package.json for the element's data-vscode-context,
	// and passes that data to the commands in src/extension.js. Headings written as HTML get none, as
	// their ids only exist in the preview. In the sidebar, VS Code's own Cut/Copy/Paste are left out.
	function setHeadingMenuContext(element, id, text, inSidebar) {
		if (id.startsWith(RAW_ID_PREFIX)) {
			delete element.dataset.vscodeContext;
			return;
		}
		const context = JSON.stringify({
			webviewSection: 'mdTocHeading',
			headingText: text,
			...headingLinks(id, text),
			...(inSidebar ? { preventDefaultContextMenuItems: true } : {}),
		});
		if (element.dataset.vscodeContext !== context) {
			element.dataset.vscodeContext = context;
		}
	}

	// Like the ids above, runs before every build in case the preview replaced a heading.
	function setDocumentHeadingMenuContexts() {
		for (const heading of document.querySelectorAll(HEADING_SELECTOR)) {
			setHeadingMenuContext(heading, heading.id, heading.textContent.trim(), false);
		}
	}

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
			const config = document.getElementById(CONFIG_ID);
			const settings = config ? JSON.stringify(config.dataset) : '';
			const signature = settings + '\n' + Array.from(document.querySelectorAll(HEADING_SELECTOR))
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
	const OWN_UI_SELECTOR = [NAV_ID, TOGGLE_ID, RESIZER_ID, SETTINGS_BUTTON_ID, SETTINGS_MENU_ID, REFRESH_BUTTON_ID].map(id => '#' + id).join(', ');
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
})();
