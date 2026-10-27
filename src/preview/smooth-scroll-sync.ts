// Runs inside VS Code's built-in Markdown preview webview.
// The preview follows the editor by jumping straight to a new position (at most ~20 times a second),
// which looks jumpy. This intercepts those sync jumps and glides to the target instead.
import { SYNCED_SCROLL_EVENT, USER_SCROLL_EVENTS } from '../shared/constants.ts'

/** Makes the preview's sync jumps glide: intercepts window.scroll and window.scrollTo while the preview follows the editor. */
class SmoothScrollSync {
	// window.scroll calls this soon after an 'updateView' message are the preview following the editor.
	private static readonly SYNC_WINDOW_MS = 200
	// Fraction of the remaining distance covered per 60fps frame.
	private static readonly EASING = 0.3

	// Captured before start() replaces window.scrollTo.
	private readonly nativeScrollTo = window.scrollTo.bind(window)
	private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

	private syncUntil = 0
	private target: number | null = null
	private position = 0
	private frame = 0
	private lastTime = 0
	private suppressScrollEvents = false

	/** Listens for sync messages, replaces window.scroll and window.scrollTo, and hides the glide's scroll events. */
	start(): void {
		// Capture phase so this runs before the preview's own message handler performs the jump.
		window.addEventListener('message', event => this.onMessage(event), true)

		window.scroll = this.intercept(window.scroll.bind(window))
		window.scrollTo = this.intercept(this.nativeScrollTo)

		window.addEventListener('scroll', event => this.onScroll(event), true)

		// The user taking over the preview cancels the glide immediately.
		for (const type of USER_SCROLL_EVENTS) {
			window.addEventListener(type, () => this.stop(), { capture: true, passive: true })
		}
	}

	/** The furthest the page can scroll down. */
	private maxScroll() {
		return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
	}

	/** Opens the sync window when the preview is told to follow the editor ('updateView'). */
	private onMessage(event: MessageEvent): void {
		if (event.data && event.data.type === 'updateView') {
			this.syncUntil = performance.now() + SmoothScrollSync.SYNC_WINDOW_MS
		}
	}

	/**
	 * While gliding, hides the in-between scroll events from the preview's own scroll handler.
	 * Otherwise it would report each position back to the editor and the two would fight.
	 */
	private onScroll(event: Event): void {
		if (this.suppressScrollEvents) {
			event.stopImmediatePropagation()
		}
	}

	/**
	 * Wraps window.scroll or window.scrollTo: sync jumps glide, every other call goes straight to the
	 * native one. Both take either an options object or x and y.
	 */
	private intercept(native: typeof window.scrollTo): typeof window.scrollTo {
		return (...args: [options?: ScrollToOptions] | [x: number, y: number]) => {
			const [x, y] = args
			const isSyncJump = performance.now() <= this.syncUntil && typeof x === 'number' && typeof y === 'number'
			if (!isSyncJump || this.reducedMotion.matches) {
				this.stop()
				Reflect.apply(native, window, args)
				return
			}
			this.glideTo(y)
		}
	}

	/** Glides towards y, or retargets a glide that is already running. */
	private glideTo(y: number) {
		if (this.target === null) {
			this.position = window.scrollY
			this.lastTime = performance.now()
		}
		this.target = Math.min(Math.max(0, y), this.maxScroll())
		this.suppressScrollEvents = true
		if (!this.frame) {
			this.frame = requestAnimationFrame(now => this.step(now))
		}
	}

	/** One frame of the glide: covers part of the remaining distance and tells listeners about the new position. */
	private step(now: number) {
		this.frame = 0
		if (this.target === null) return
		const elapsedFrames = Math.min(4, (now - this.lastTime) / (1000 / 60))
		this.lastTime = now
		const remaining = this.target - this.position
		if (Math.abs(remaining) < 1) {
			this.position = this.target
			this.target = null
		} else {
			this.position += remaining * (1 - Math.pow(1 - SmoothScrollSync.EASING, elapsedFrames))
		}

		this.nativeScrollTo({ left: window.scrollX, top: this.position, behavior: 'instant' })
		window.dispatchEvent(new Event(SYNCED_SCROLL_EVENT))

		if (this.target !== null) {
			this.frame = requestAnimationFrame(now => this.step(now))
		} else {
			// The scroll event for this last position fires before the next frame's callbacks.
			requestAnimationFrame(() => {
				if (this.target === null) {
					this.suppressScrollEvents = false
				}
			})
		}
	}

	/** Cancels the glide where it is. */
	private stop() {
		cancelAnimationFrame(this.frame)
		this.frame = 0
		this.target = null
		this.suppressScrollEvents = false
	}
}

if (!window.__mdTocSmoothSyncInitialized) {
	window.__mdTocSmoothSyncInitialized = true
	new SmoothScrollSync().start()
}
