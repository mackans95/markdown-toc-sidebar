// Runs inside VS Code's built-in Markdown preview webview.
// VS Code doesn't keep a preview running while its tab is in the background: when the tab is shown
// again, it rebuilds the page from the HTML of the preview's last full render. That HTML carries the
// scroll position from back then (where the editor was when the preview opened), and the preview
// restores that instead of where you had scrolled to since, so it jumps back, often to the top.
// This remembers where you were and goes back there when the same render is rebuilt.
import { SYNCED_SCROLL_EVENT } from '../shared/constants.ts';
import { readStoredJson, writeStored } from './storage.ts';
import type { Position, SavedPosition } from '../types/preview.ts';

declare global {
	interface Window {
		/** Set once this script has started, so loading it twice doesn't start it twice. */
		__mdTocScrollRestoreInitialized?: boolean;
	}
}

/** Remembers the scroll position of this render, and restores it if the page is a rebuild of one seen before. */
function start() {
	const STORAGE_KEY = 'md-toc-sidebar.scroll-positions';
	const MAX_ENTRIES = 50;
	// How long after the page has loaded we keep correcting the position while it settles.
	const SETTLE_MS = 1000;
	const SAVE_DELAY_MS = 100;

	// Every full render gets a new CSP nonce, and a rebuilt page reuses its HTML, nonce included.
	// So the nonce tells a rebuilt page (restore) apart from a new render (leave it to the preview).
	const renderId = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
	if (!renderId) {
		return;
	}

	/** The saved positions, by render id. */
	function readPositions(): Record<string, SavedPosition> {
		return readStoredJson(STORAGE_KEY, {});
	}

	/** Saves the current position for this render, keeping only the MAX_ENTRIES most recent renders. */
	function savePosition() {
		const positions = readPositions();
		positions[renderId] = { ...currentPosition(), time: Date.now() };
		const newest = Object.entries(positions)
			.sort((a, b) => b[1].time - a[1].time)
			.slice(0, MAX_ENTRIES);
		writeStored(STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)));
	}

	/**
	 * The block at the top of the view and how far into it we are. Unlike a pixel offset, that stays
	 * right when the text reflows, e.g. while the sidebar takes its space. Blocks are walked in
	 * document order, so of nested blocks (a list and its items) the innermost one wins.
	 */
	function currentPosition(): Position {
		let anchor;
		for (const block of document.querySelectorAll<HTMLElement>('.markdown-body [data-line]')) {
			const rect = block.getBoundingClientRect();
			if (rect.top > 0) {
				break;
			}
			anchor = { line: block.dataset.line, progress: -rect.top / Math.max(rect.height, 1) };
		}
		return { ...anchor, y: window.scrollY };
	}

	/** Scrolls back to a saved position: into its block when that's still there, otherwise to the plain offset. */
	function scrollToPosition(position: Position) {
		const blocks = document.querySelectorAll(`.markdown-body [data-line="${CSS.escape(String(position.line))}"]`);
		const block = blocks[blocks.length - 1];
		let top = position.y;
		if (block) {
			const rect = block.getBoundingClientRect();
			top = window.scrollY + rect.top + (position.progress ?? 0) * rect.height;
		}
		if (Math.abs(window.scrollY - top) >= 1) {
			window.scrollTo({ top, behavior: 'instant' });
		}
	}

	const saved = readPositions()[renderId];
	let settling = !!saved;
	let saveTimer = 0;

	/** While settling, puts the saved position back; otherwise saves the new position once scrolling pauses. */
	function onScroll() {
		if (settling) {
			// Not the user (they end settling first): the preview's own restore or a reflow moved us.
			scrollToPosition(saved);
			return;
		}
		clearTimeout(saveTimer);
		saveTimer = setTimeout(savePosition, SAVE_DELAY_MS);
	}
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener(SYNCED_SCROLL_EVENT, onScroll);

	// The tab going to the background destroys the page, so don't leave the last position pending.
	window.addEventListener('pagehide', () => {
		if (!settling) {
			clearTimeout(saveTimer);
			savePosition();
		}
	});

	if (!saved) {
		return;
	}

	// The preview restores its own (stale) position once the page and its images have loaded, and
	// the sidebar and images make the content reflow. Keep putting the position back until that's
	// done, or until the user scrolls themselves.
	const resizeObserver = new ResizeObserver(() => {
		if (settling) {
			scrollToPosition(saved);
		}
	});
	resizeObserver.observe(document.body);

	/** Stops correcting the position, once the user scrolls or the page has settled, and saves where it is. */
	function stopSettling() {
		if (settling) {
			settling = false;
			resizeObserver.disconnect();
			savePosition();
		}
	}
	for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
		window.addEventListener(type, stopSettling, { capture: true, passive: true });
	}

	/** Once the page has loaded, restores the position once more and stops settling SETTLE_MS later. */
	function onLoaded() {
		setTimeout(() => {
			if (settling) {
				scrollToPosition(saved);
			}
			setTimeout(stopSettling, SETTLE_MS);
		}, 0);
	}
	if (document.readyState === 'complete') {
		onLoaded();
	} else {
		window.addEventListener('load', onLoaded, { once: true });
	}
}

if (!window.__mdTocScrollRestoreInitialized) {
	window.__mdTocScrollRestoreInitialized = true;
	start();
}
