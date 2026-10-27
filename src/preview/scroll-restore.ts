// Runs inside VS Code's built-in Markdown preview webview.
// VS Code doesn't keep a preview running while its tab is in the background: when the tab is shown
// again, it rebuilds the page from the HTML of the preview's last full render. That HTML carries the
// scroll position from back then (where the editor was when the preview opened), and the preview
// restores that instead of where you had scrolled to since, so it jumps back, often to the top.
// This remembers where you were and goes back there when the same render is rebuilt.
import { SYNCED_SCROLL_EVENT, USER_SCROLL_EVENTS } from '../shared/constants.ts'
import { readStoredJson, writeStored } from './storage.ts'
import type { Position, SavedPosition } from '../types/preview.ts'

/** Remembers where you were in a render, and goes back there when VS Code rebuilds the page from it. */
class ScrollRestore {
	private static readonly STORAGE_KEY = 'md-toc-sidebar.scroll-positions'
	private static readonly MAX_ENTRIES = 50
	// How long after the page has loaded we keep correcting the position while it settles.
	private static readonly SETTLE_MS = 1000
	private static readonly SAVE_DELAY_MS = 100

	// Every full render gets a new CSP nonce, and a rebuilt page reuses its HTML, nonce included.
	// So the nonce tells a rebuilt page (restore) apart from a new render (leave it to the preview).
	private readonly renderId = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''
	// The saved position to put back while the page settles; undefined once it has settled, or when
	// this render has none saved.
	private restoring: Position | undefined
	private saveTimer = 0
	// The preview restores its own (stale) position once the page and its images have loaded, and
	// the sidebar and images make the content reflow. While settling, each resize puts the position back.
	private readonly resizeObserver = new ResizeObserver(() => this.reapply())

	/** Saves the position as you scroll, and restores the saved one if this page is a rebuild of a render seen before. */
	start(): void {
		if (!this.renderId) return

		this.restoring = this.readPositions()[this.renderId]
		window.addEventListener('scroll', () => this.onScroll(), { passive: true })
		window.addEventListener(SYNCED_SCROLL_EVENT, () => this.onScroll())
		window.addEventListener('pagehide', () => this.onPageHide())

		if (this.restoring) {
			this.startSettling()
		}
	}

	/** Keeps putting the saved position back until the page has settled or the user scrolls. */
	private startSettling(): void {
		this.resizeObserver.observe(document.body)
		// The user scrolling themselves ends it right away.
		for (const type of USER_SCROLL_EVENTS) {
			window.addEventListener(type, () => this.stopSettling(), { capture: true, passive: true })
		}
		if (document.readyState === 'complete') {
			this.onLoaded()
		} else {
			window.addEventListener('load', () => this.onLoaded(), { once: true })
		}
	}

	/** Puts the saved position back, while there still is one to restore. */
	private reapply(): void {
		if (this.restoring) {
			this.scrollToPosition(this.restoring)
		}
	}

	/** While settling, puts the saved position back; otherwise saves the new position once scrolling pauses. */
	private onScroll(): void {
		if (this.restoring) {
			// Not the user (they end settling first): the preview's own restore or a reflow moved us.
			this.reapply()
			return
		}
		clearTimeout(this.saveTimer)
		this.saveTimer = setTimeout(() => this.savePosition(), ScrollRestore.SAVE_DELAY_MS)
	}

	/** The tab going to the background destroys the page, so the last position is saved right away instead of left pending. */
	private onPageHide(): void {
		if (!this.restoring) {
			clearTimeout(this.saveTimer)
			this.savePosition()
		}
	}

	/** Stops correcting the position, once the user scrolls or the page has settled, and saves where it is. */
	private stopSettling(): void {
		if (this.restoring) {
			this.restoring = undefined
			this.resizeObserver.disconnect()
			this.savePosition()
		}
	}

	/** Once the page has loaded, restores the position once more and stops settling SETTLE_MS later. */
	private onLoaded(): void {
		setTimeout(() => {
			this.reapply()
			setTimeout(() => this.stopSettling(), ScrollRestore.SETTLE_MS)
		}, 0)
	}

	/** The saved positions, by render id. */
	private readPositions(): Record<string, SavedPosition> {
		return readStoredJson(ScrollRestore.STORAGE_KEY, {})
	}

	/** Saves the current position for this render, keeping only the MAX_ENTRIES most recent renders. */
	private savePosition(): void {
		const positions = this.readPositions()
		positions[this.renderId] = { ...this.currentPosition(), time: Date.now() }
		const newest = Object.entries(positions)
			.sort((a, b) => b[1].time - a[1].time)
			.slice(0, ScrollRestore.MAX_ENTRIES)
		writeStored(ScrollRestore.STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)))
	}

	/**
	 * The block at the top of the view and how far into it we are. Unlike a pixel offset, that stays
	 * right when the text reflows, e.g. while the sidebar takes its space. Blocks are walked in
	 * document order, so of nested blocks (a list and its items) the innermost one wins.
	 */
	private currentPosition(): Position {
		let anchor
		for (const block of document.querySelectorAll<HTMLElement>('.markdown-body [data-line]')) {
			const rect = block.getBoundingClientRect()
			if (rect.top > 0) {
				break
			}
			anchor = { line: block.dataset.line, progress: -rect.top / Math.max(rect.height, 1) }
		}
		return { ...anchor, y: window.scrollY }
	}

	/** Scrolls back to a saved position: into its block when that's still there, otherwise to the plain offset. */
	private scrollToPosition(position: Position): void {
		const blocks = document.querySelectorAll(`.markdown-body [data-line="${CSS.escape(String(position.line))}"]`)
		const block = blocks[blocks.length - 1]
		let top = position.y
		if (block) {
			const rect = block.getBoundingClientRect()
			top = window.scrollY + rect.top + (position.progress ?? 0) * rect.height
		}
		if (Math.abs(window.scrollY - top) >= 1) {
			window.scrollTo({ top, behavior: 'instant' })
		}
	}
}

if (!window.__mdTocScrollRestoreInitialized) {
	window.__mdTocScrollRestoreInitialized = true
	new ScrollRestore().start()
}
