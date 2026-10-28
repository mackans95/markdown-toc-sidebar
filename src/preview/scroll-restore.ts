// Runs inside VS Code's built-in Markdown preview webview.
// VS Code doesn't keep a preview running while its tab is in the background: when the tab is shown
// again, it rebuilds the page from the HTML of the preview's last full render. That HTML carries the
// scroll position from back then (where the editor was when the preview opened), and the preview
// restores that instead of where you had scrolled to since, so it jumps back, often to the top.
// This remembers where you were and goes back there when the same render is rebuilt.
// It also remembers where you were in each file, for when src/preview-refresher.ts refreshes the previews:
// the refresh makes a new render, which would otherwise start where the preview puts it.
import { CONFIG_ELEMENT_ID, SYNCED_SCROLL_EVENT, USER_SCROLL_EVENTS } from '../shared/constants.ts'
import { keepNewest, readStoredJson, writeStored } from './storage.ts'
import type { Position, SavedPosition } from '../types/preview.ts'

/** Remembers where you were in a render and in its file, and goes back there when VS Code rebuilds the page or a refresh renders it anew. */
class ScrollRestore {
	private static readonly STORAGE_KEY = 'md-toc-sidebar.scroll-positions'
	private static readonly FILE_STORAGE_KEY = 'md-toc-sidebar.file-scroll-positions'
	private static readonly MAX_ENTRIES = 50
	// How long after the page has loaded we keep correcting the position while it settles.
	private static readonly SETTLE_MS = 1000
	private static readonly SAVE_DELAY_MS = 100

	// Every full render gets a new CSP nonce, and a rebuilt page reuses its HTML, nonce included.
	// So the nonce tells a rebuilt page (restore) apart from a new render (leave it to the preview, unless a refresh made it).
	private readonly renderId = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''
	// The file this render shows, from the config element; empty until it's there, or without it.
	private file = ''
	// The preview puts the content, config element included, into the page after this script may have
	// started. Until it's there, the file isn't known, so nothing is saved.
	private waitingForConfig = false
	// The saved position to put back while the page settles; undefined once it has settled, or when
	// this render has none saved.
	private restoring: Position | undefined
	private saveTimer = 0
	// The preview restores its own (stale) position once the page and its images have loaded, and
	// the sidebar and images make the content reflow. While settling, each resize puts the position back.
	private readonly resizeObserver = new ResizeObserver(() => this.reapply())

	/**
	 * Saves the position as you scroll. Restores the saved one if this page is a rebuild of a render seen
	 * before, or the file's if it's a new render that a refresh made.
	 */
	start(): void {
		if (!this.renderId) return

		this.restoring = this.readPositions(ScrollRestore.STORAGE_KEY)[this.renderId]
		window.addEventListener('scroll', () => this.onScroll(), { passive: true })
		window.addEventListener(SYNCED_SCROLL_EVENT, () => this.onScroll())
		window.addEventListener('pagehide', () => this.onPageHide())

		if (this.restoring) {
			this.startSettling()
		}
		this.waitingForConfig = true
		this.waitForConfig()
	}

	/** Calls onConfig once the config element is in the page, or gives up when the page has loaded without it. */
	private waitForConfig(): void {
		if (document.getElementById(CONFIG_ELEMENT_ID)) {
			this.onConfig()
			return
		}
		const observer = new MutationObserver(() => {
			if (document.getElementById(CONFIG_ELEMENT_ID)) {
				observer.disconnect()
				this.onConfig()
			}
		})
		observer.observe(document, { childList: true, subtree: true })
		window.addEventListener(
			'load',
			() => {
				observer.disconnect()
				this.onConfig()
			},
			{ once: true },
		)
	}

	/** Notes the file once the config element is there. A new render that a refresh made then restores the file's position. */
	private onConfig(): void {
		if (!this.waitingForConfig) return
		this.waitingForConfig = false

		const config = document.getElementById(CONFIG_ELEMENT_ID)
		this.file = config?.dataset.document ?? ''
		if (this.restoring || !this.file || config?.dataset.fromRefresh !== 'true') return

		this.restoring = this.readPositions(ScrollRestore.FILE_STORAGE_KEY)[this.file]
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
		if (this.waitingForConfig) return
		clearTimeout(this.saveTimer)
		this.saveTimer = setTimeout(() => this.savePosition(), ScrollRestore.SAVE_DELAY_MS)
	}

	/** The tab going to the background destroys the page, so the last position is saved right away instead of left pending. */
	private onPageHide(): void {
		if (!this.restoring && !this.waitingForConfig) {
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

	/** The saved positions under a storage key: by render id, or by file. */
	private readPositions(storageKey: string): Record<string, SavedPosition> {
		return readStoredJson(storageKey, {})
	}

	/** Saves the current position for this render and its file, keeping only the MAX_ENTRIES most recent of each. */
	private savePosition(): void {
		const position = { ...this.currentPosition(), time: Date.now() }
		this.storePosition(ScrollRestore.STORAGE_KEY, this.renderId, position)
		if (this.file) {
			this.storePosition(ScrollRestore.FILE_STORAGE_KEY, this.file, position)
		}
	}

	/** Stores a position under a storage key and id, keeping only the MAX_ENTRIES most recent. */
	private storePosition(storageKey: string, id: string, position: SavedPosition): void {
		const positions = this.readPositions(storageKey)
		positions[id] = position
		writeStored(storageKey, JSON.stringify(keepNewest(positions, ScrollRestore.MAX_ENTRIES)))
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
