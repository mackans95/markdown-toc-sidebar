// The sidebar itself: the list of entries, rebuilt whenever the headings or the settings change.
import { CONFIG_ELEMENT_ID } from '../../shared/constants.ts'
import { activeHighlight } from './active.ts'
import { collapsedSections } from './collapse.ts'
import { readConfig, sidebarPosition } from './config.ts'
import { HEADING_SELECTOR, keepDoubleClickInside, NAV_ID } from './dom.ts'
import { assignRawHeadingIds, setDocumentHeadingMenuContexts, setHeadingMenuContext } from './headings.ts'
import { onNavKeydown, setTabStop } from './keyboard.ts'
import { buildEntries, hasChildren } from './outline.ts'
import { updateResizerValue } from './resizer.ts'
import { updateSettingsMenu } from './settings-menu.ts'
import { updateToggle } from './toggle.ts'
import type { Entry } from '../../types/preview.ts'

/** The sidebar's nav element, created with its keyboard handling the first time. */
function getNav(): HTMLElement {
	let nav = document.getElementById(NAV_ID)

	if (!nav) {
		const created = document.createElement('nav')
		created.id = NAV_ID
		created.setAttribute('aria-label', 'Table of contents')

		keepDoubleClickInside(created)

		created.addEventListener('keydown', onNavKeydown)
		// Whichever entry gets focus, by keyboard or mouse, becomes the list's tab stop.
		created.addEventListener('focusin', e => {
			const link = e.target instanceof Element && e.target.closest('a')
			if (link) {
				setTabStop(created, link)
			}
		})

		// Lives directly under <body>, outside .markdown-body, so preview re-renders leave it alone.
		document.body.appendChild(created)
		nav = created
	}

	return nav
}

/** Applies the settings from the config element: sidebar side, toggle icon and the menu's links. */
function applyConfig(): void {
	const config = document.getElementById(CONFIG_ELEMENT_ID)

	// Without the config element (src/extension.ts not active), settings can't be changed from here.
	document.body.classList.toggle('md-toc-configurable', !!(config && config.dataset.uriBase))
	document.body.classList.toggle('md-toc-left', sidebarPosition() === 'left')

	updateToggle()
	updateSettingsMenu()
}

/** The link for one entry, with its number when numbering is on. */
function createLink(entry: Entry): HTMLAnchorElement {
	const link = document.createElement('a')
	link.href = '#' + entry.id
	link.textContent = entry.text
	link.dataset.target = entry.id
	link.dataset.level = String(entry.level)
	link.title = entry.text

	// activeHighlight.highlight makes one entry the tab stop; the arrow keys move between them.
	link.tabIndex = -1

	setHeadingMenuContext(link, entry.id, entry.text, true)

	if (entry.number) {
		const number = document.createElement('span')
		number.className = 'md-toc-number'
		number.textContent = entry.number
		link.prepend(number)
	}

	return link
}

/** The list of entries, rebuilt at most once per frame and only when the headings or the settings changed. */
class Sidebar {
	// The headings and settings the list was last built from, so a rebuild that would change nothing is skipped.
	private lastSignature = ''
	// The frame a rebuild is waiting for, so calls within one frame share it; 0 when none is waiting.
	private buildFrame = 0

	/** Rebuilds the sidebar on the next frame if the headings or the settings changed; calls within one frame share a rebuild. */
	scheduleBuild(): void {
		if (this.buildFrame) return

		this.buildFrame = requestAnimationFrame(() => {
			this.buildFrame = 0
			applyConfig()
			assignRawHeadingIds()
			setDocumentHeadingMenuContexts()

			const config = document.getElementById(CONFIG_ELEMENT_ID)
			const settings = config ? JSON.stringify(config.dataset) : ''
			const signature = `${settings}\n${Array.from(document.querySelectorAll(HEADING_SELECTOR))
				.map(h => `${h.tagName}#${h.id}:${h.textContent}`)
				.join('\n')}`

			if (signature !== this.lastSignature || !document.getElementById(NAV_ID)) {
				this.lastSignature = signature
				this.build()
			}
		})
	}

	/** Rebuilds the list from the document's headings and the current settings. */
	private build(): void {
		activeHighlight.reset()

		const headings = Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
		const nav = getNav()

		if (headings.length === 0) {
			activeHighlight.setListedIds(new Set())
			nav.replaceChildren()
			document.body.classList.remove('md-toc-visible')
			return
		}

		const maxDepth = Number(readConfig('maxDepth'))
		const topHeading = readConfig('topHeading')
		const numbering = readConfig('numbering') === 'true'
		const entries = buildEntries(
			headings.map(h => ({ id: h.id, text: h.textContent.trim(), level: Number(h.tagName[1]) })),
			{ maxDepth, topHeading, numbering },
		)

		activeHighlight.setListedIds(new Set(entries.map(entry => entry.id)))

		const collapsible = readConfig('collapsible') === 'true'
		const listEntries = entries.filter(entry => !entry.isTitle)
		const list = document.createElement('ul')

		listEntries.forEach((entry, i) => {
			const item = document.createElement('li')
			item.style.setProperty('--md-toc-depth', String(entry.depth))

			if (collapsible) {
				item.appendChild(
					hasChildren(listEntries, i)
						? collapsedSections.createChevron(entry)
						: collapsedSections.createChevronSpacer(),
				)
			}

			item.appendChild(createLink(entry))
			list.appendChild(item)
		})

		nav.classList.toggle('md-toc-collapsible', collapsible)

		// Pinned while the list scrolls: the "Contents" row next to the header buttons, and the
		// document's title below it when topHeading is 'title'.
		const header = document.createElement('div')
		header.className = 'md-toc-header'
		const title = document.createElement('div')
		title.className = 'md-toc-title'
		title.textContent = 'Contents'

		header.appendChild(title)

		const titleEntry = entries.find(entry => entry.isTitle)

		if (titleEntry) {
			const docTitle = createLink(titleEntry)
			docTitle.className = 'md-toc-doc-title'
			header.appendChild(docTitle)
		}

		nav.classList.toggle('md-toc-has-doc-title', !!titleEntry)
		nav.replaceChildren(header, list)
		document.body.classList.add('md-toc-visible')

		collapsedSections.load()
		collapsedSections.apply()
		updateResizerValue()
		activeHighlight.update()
	}
}

export const sidebar = new Sidebar()
