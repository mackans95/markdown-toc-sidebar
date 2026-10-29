// The list's scrollbar for markdownTocSidebar.scrollbar 'hover'. The list's own scrollbar takes space
// beside the entries; this one is drawn on top of them instead and only shows while the pointer is over
// the sidebar, so it takes no space and nothing shifts when it appears. toc.css hides the list's own.
import { readConfig } from './config.ts'

// The thumb never gets shorter than this, so it stays easy to grab in a long list.
const MIN_THUMB_HEIGHT = 20
// How far one line of a line-based wheel scrolls, as browsers commonly treat it.
const WHEEL_LINE_HEIGHT = 16
const DRAGGING_CLASS = 'md-toc-scrollbar-dragging'

/** The thumb's height and offset in a track as tall as the list's visible part. */
export function thumbMetrics(visible: number, total: number, scrolled: number): { height: number; top: number } {
	const height = Math.min(visible, Math.max(MIN_THUMB_HEIGHT, (visible * visible) / total))
	const maxScroll = total - visible
	const top = maxScroll > 0 ? (Math.min(scrolled, maxScroll) / maxScroll) * (visible - height) : 0

	return { height, top }
}

/** Draws a scrollbar on top of the list, and lets you drag its thumb, click its track and wheel over it. */
class OverlayScrollbar {
	// Created with the first list that needs them, so creating this doesn't need the DOM.
	private track: HTMLDivElement | undefined
	private thumb: HTMLDivElement | undefined
	private resizeObserver: ResizeObserver | undefined
	private hiddenObserver: MutationObserver | undefined
	// The list being drawn for; undefined when the setting isn't 'hover'.
	private list: HTMLElement | undefined
	// Where a drag of the thumb started, while one is going on.
	private drag: { startY: number; startScroll: number } | undefined

	/** Draws the scrollbar for a newly built list when the setting is 'hover', and stops drawing it otherwise. */
	attach(nav: HTMLElement, list: HTMLElement): void {
		this.resizeObserver?.disconnect()
		this.hiddenObserver?.disconnect()
		this.list = undefined

		if (readConfig('scrollbar') !== 'hover') return

		const track = this.track ?? this.createElements()
		// The rebuild replaced the nav's contents, this included.
		nav.appendChild(track)
		this.list = list
		list.addEventListener('scroll', () => this.update(), { passive: true })
		// The list's height changes with the sidebar, and how much it holds when sections collapse.
		this.resizeObserver!.observe(list)
		this.hiddenObserver!.observe(list, { subtree: true, attributes: true, attributeFilter: ['hidden'] })
		this.update()
	}

	/** The track and its thumb, with their pointer and wheel handling. */
	private createElements(): HTMLDivElement {
		const track = document.createElement('div')
		track.className = 'md-toc-scrollbar'
		track.setAttribute('aria-hidden', 'true')

		const thumb = document.createElement('div')
		thumb.className = 'md-toc-scrollbar-thumb'
		track.appendChild(thumb)

		track.addEventListener('pointerdown', e => this.onTrackPointerDown(e))
		track.addEventListener('wheel', e => this.onWheel(e), { passive: false })
		thumb.addEventListener('pointerdown', e => this.startDrag(e))
		thumb.addEventListener('pointermove', e => this.moveDrag(e))
		thumb.addEventListener('pointerup', e => this.endDrag(e))
		thumb.addEventListener('pointercancel', e => this.endDrag(e))

		this.track = track
		this.thumb = thumb
		this.resizeObserver = new ResizeObserver(() => this.update())
		this.hiddenObserver = new MutationObserver(() => this.update())

		return track
	}

	/** Lines the track up with the list, and sizes and places the thumb; hides it when the list fits. */
	private update(): void {
		const { list, track, thumb } = this
		if (!list || !track || !thumb) return

		track.hidden = list.scrollHeight <= list.clientHeight
		if (track.hidden) return

		const { height, top } = thumbMetrics(list.clientHeight, list.scrollHeight, list.scrollTop)
		track.style.top = `${list.offsetTop}px`
		track.style.height = `${list.clientHeight}px`
		thumb.style.height = `${height}px`
		thumb.style.transform = `translateY(${top}px)`
	}

	/** Starts dragging the thumb with the main button. */
	private startDrag(e: PointerEvent): void {
		if (e.button !== 0 || !this.list) return

		// No text selection, and no page jump from the track underneath.
		e.preventDefault()
		e.stopPropagation()
		this.thumb!.setPointerCapture(e.pointerId)
		this.drag = { startY: e.clientY, startScroll: this.list.scrollTop }
		this.track!.classList.add(DRAGGING_CLASS)
	}

	/** Scrolls the list as far as the thumb has moved, scaled from the track to the list. */
	private moveDrag(e: PointerEvent): void {
		const { list, drag } = this
		if (!list || !drag || !this.thumb!.hasPointerCapture(e.pointerId)) return

		const { height } = thumbMetrics(list.clientHeight, list.scrollHeight, list.scrollTop)
		const room = list.clientHeight - height
		const maxScroll = list.scrollHeight - list.clientHeight
		list.scrollTop = drag.startScroll + (room > 0 ? ((e.clientY - drag.startY) * maxScroll) / room : 0)
	}

	/** Ends a drag, also a cancelled one. */
	private endDrag(e: PointerEvent): void {
		if (!this.drag) return

		this.thumb!.releasePointerCapture(e.pointerId)
		this.drag = undefined
		this.track!.classList.remove(DRAGGING_CLASS)
	}

	/** A click on the track beside the thumb scrolls the list a page towards it, like a native scrollbar. */
	private onTrackPointerDown(e: PointerEvent): void {
		if (e.button !== 0 || !this.list) return

		e.preventDefault()
		const direction = e.clientY < this.thumb!.getBoundingClientRect().top ? -1 : 1
		this.list.scrollBy({ top: direction * this.list.clientHeight, behavior: 'instant' })
	}

	/** The track isn't inside the list, so the browser wouldn't scroll the list for a wheel over it: do that here. */
	private onWheel(e: WheelEvent): void {
		if (e.ctrlKey || !this.list) return

		e.preventDefault()
		const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE
		this.list.scrollTop += lines ? e.deltaY * WHEEL_LINE_HEIGHT : e.deltaY
	}
}

export const overlayScrollbar = new OverlayScrollbar()
