// Runs inside VS Code's built-in Markdown preview webview.
// Builds a table of contents from the rendered headings and keeps it in sync.
(function () {
	const NAV_ID = 'md-toc-sidebar';
	const TOGGLE_ID = 'md-toc-toggle';
	const RESIZER_ID = 'md-toc-resizer';
	const HEADING_SELECTOR = '.markdown-body :is(h1, h2, h3, h4, h5, h6)[id]';

	// Contributed scripts may be re-evaluated on content changes; only wire up once.
	if (window.__mdTocSidebarInitialized) {
		buildToc();
		return;
	}
	window.__mdTocSidebarInitialized = true;

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
			// Lives directly under <body>, outside .markdown-body, so preview re-renders leave it alone.
			document.body.appendChild(nav);
		}
		return nav;
	}

	const COLLAPSED_KEY = 'md-toc-sidebar.collapsed';
	const ICON_HIDE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
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
		document.body.classList.toggle('md-toc-collapsed', collapsed);
		const toggle = getToggle();
		const label = collapsed ? 'Show table of contents' : 'Hide table of contents';
		toggle.innerHTML = collapsed ? ICON_SHOW : ICON_HIDE;
		toggle.title = label;
		toggle.setAttribute('aria-label', label);
		toggle.setAttribute('aria-expanded', String(!collapsed));
		writeCollapsed(collapsed);
		if (!collapsed) {
			updateActive();
		}
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
			// The sidebar is pinned to the right edge, so its width is the distance from the pointer to it.
			dragWidth = clampWidth(viewportWidth() - event.clientX);
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
			// Left widens (the handle moves left), right narrows.
			const delta = event.key === 'ArrowLeft' ? KEYBOARD_STEP : event.key === 'ArrowRight' ? -KEYBOARD_STEP : 0;
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
		const headings = Array.from(document.querySelectorAll(HEADING_SELECTOR));
		const nav = getNav();

		if (headings.length === 0) {
			nav.replaceChildren();
			document.body.classList.remove('md-toc-visible');
			return;
		}

		const baseLevel = Math.min(...headings.map(h => Number(h.tagName[1])));
		const list = document.createElement('ul');

		for (const heading of headings) {
			const level = Number(heading.tagName[1]);
			const item = document.createElement('li');
			item.style.setProperty('--md-toc-depth', String(level - baseLevel));

			const link = document.createElement('a');
			link.href = '#' + heading.id;
			link.textContent = heading.textContent.trim();
			link.dataset.target = heading.id;
			link.dataset.level = String(level);
			link.title = link.textContent;

			item.appendChild(link);
			list.appendChild(item);
		}

		const title = document.createElement('div');
		title.className = 'md-toc-title';
		title.textContent = 'Contents';

		nav.replaceChildren(title, list);
		document.body.classList.add('md-toc-visible');
		updateResizerValue();
		updateActive();
	}

	// While a TOC click's scroll is in flight, keep the clicked entry highlighted instead of
	// recomputing from scroll position (short sections or the end of the page would pick another).
	let pinnedId = null;
	let unpinTimer = 0;

	function pinActive(id) {
		pinnedId = id;
		clearTimeout(unpinTimer);
		// Fallback for when the click causes no scroll at all, so no scrollend fires.
		unpinTimer = setTimeout(unpin, 300);
	}

	function unpin() {
		clearTimeout(unpinTimer);
		pinnedId = null;
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

	function setActiveLink(id) {
		const nav = document.getElementById(NAV_ID);
		if (!nav) {
			return;
		}
		const links = Array.from(nav.querySelectorAll('a'));
		const activeIndex = links.findIndex(link => link.dataset.target === id);

		// The sections containing the active one: walking back up the list, each entry with a
		// lower level than the last one found is the next enclosing section.
		const ancestors = new Set();
		if (activeIndex >= 0) {
			let level = Number(links[activeIndex].dataset.level);
			for (let i = activeIndex - 1; i >= 0 && level > 1; i--) {
				const linkLevel = Number(links[i].dataset.level);
				if (linkLevel < level) {
					ancestors.add(links[i]);
					level = linkLevel;
				}
			}
		}

		links.forEach((link, i) => {
			link.classList.toggle('active', i === activeIndex);
			link.classList.toggle('active-ancestor', ancestors.has(link));
		});
		if (activeIndex >= 0) {
			links[activeIndex].scrollIntoView({ block: 'nearest' });
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
		const active = findActiveHeading(Array.from(document.querySelectorAll(HEADING_SELECTOR)));
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
			pinActive(target.id);
			setActiveLink(target.id);
			target.scrollIntoView({ block: 'start' });
			flashHeading(target);
		}
	}, true);

	// Once the click-triggered scroll settles, go back to tracking the scroll position.
	window.addEventListener('scrollend', () => {
		if (pinnedId) {
			// Drop any recompute queued by that scroll so it can't override the clicked entry.
			cancelAnimationFrame(scrollFrame);
			scrollFrame = 0;
			unpin();
		}
	});

	let scrollFrame = 0;
	function onScroll() {
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

	// Rebuild at most once per frame, and only when the headings actually changed.
	let lastSignature = '';
	let buildFrame = 0;
	function scheduleBuild() {
		if (buildFrame) {
			return;
		}
		buildFrame = requestAnimationFrame(() => {
			buildFrame = 0;
			const signature = Array.from(document.querySelectorAll(HEADING_SELECTOR))
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
	new MutationObserver(records => {
		const nav = document.getElementById(NAV_ID);
		if (records.some(r => !nav || !nav.contains(r.target))) {
			scheduleBuild();
		}
	}).observe(document.body, { childList: true, subtree: true, characterData: true });

	// Fired by the built-in preview after it patches in new content.
	window.addEventListener('vscode.markdown.updateContent', scheduleBuild);

	initResizer();
	setCollapsed(readCollapsed());
	scheduleBuild();
})();
