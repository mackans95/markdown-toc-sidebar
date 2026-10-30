// Settings menu behind the cog button. Its options are vscode:// links: the preview can't change
// VS Code settings itself, so VS Code hands those links to src/extension.ts, which updates the
// setting and refreshes the preview (which then shows the new value here).
import { CONFIG_ELEMENT_ID } from '../../shared/constants.ts'
import { readStored, writeStored } from '../storage.ts'
import { keepDoubleClickInside, REFRESH_BUTTON_ID, SETTINGS_BUTTON_ID, SETTINGS_MENU_ID } from './dom.ts'
import { ICON_CLOSE, ICON_REFRESH, ICON_SETTINGS } from './icons.ts'
import { sidebar } from './sidebar.ts'
import type { SettingGroup } from '../../types/preview.ts'

const SETTING_GROUPS: SettingGroup[] = [
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
	{
		key: 'autoCollapse',
		label: 'Auto-collapse',
		requires: 'collapsible',
		options: [
			['false', 'Off'],
			['true', 'On'],
		],
	},
	{
		key: 'scrollbar',
		label: 'Scrollbar',
		options: [
			['visible', 'Visible'],
			['hover', 'On hover'],
			['hidden', 'Hidden'],
		],
	},
	{
		key: 'indentGuides',
		label: 'Indent guides',
		options: [
			['auto', 'Auto'],
			['onHover', 'On hover'],
			['always', 'Always'],
			['none', 'Off'],
		],
	},
]

// Other open previews share this page's storage, so a key written here reaches them as a
// 'storage' event. That lets a choice from the menu show up everywhere without a reload.
const LIVE_SETTING_KEY = 'md-toc-sidebar.live-setting'
// When the refresh button was last clicked. The refresh replaces the page, so the new page reads
// this to finish the icon's spin.
const REFRESH_CLICK_KEY = 'md-toc-sidebar.refresh-clicked'
// How soon after a click a new page still counts as that refresh.
const REFRESH_SPIN_MS = 3000
// How long one turn of the spin takes; the same as md-toc-refreshing's animation in styles/header-buttons.css.
const REFRESH_TURN_MS = 800
// The class that plays the menu's closing animation; see closeSettingsMenu.
const CLOSING_CLASS = 'md-toc-menu-closing'

/** Whether the menu is open. The cog's aria-expanded says so, also while the menu plays its closing animation. */
function isMenuOpen(): boolean {
	return document.getElementById(SETTINGS_BUTTON_ID)?.getAttribute('aria-expanded') === 'true'
}

/** Opens the menu; from the keyboard, focuses the current value. */
function openSettingsMenu(fromKeyboard: boolean): void {
	const menu = document.getElementById(SETTINGS_MENU_ID)!
	// Reopened while it was still closing: show it again right away.
	menu.classList.remove(CLOSING_CLASS)
	menu.hidden = false
	document.getElementById(SETTINGS_BUTTON_ID)!.setAttribute('aria-expanded', 'true')
	if (fromKeyboard) {
		menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
	}
}

/** Applies a setting to this preview right away through the config element, before VS Code has saved it. */
function applySettingLocally(key: string, value: string): void {
	const config = document.getElementById(CONFIG_ELEMENT_ID)
	if (config) {
		config.dataset[key] = value
		sidebar.scheduleBuild()
	}
}

/** Tells the other open previews about a setting chosen here (see LIVE_SETTING_KEY). */
function broadcastSetting(key: string, value: string): void {
	// The timestamp makes every write a change, so repeated choices still fire the event.
	writeStored(LIVE_SETTING_KEY, JSON.stringify({ key, value, time: Date.now() }))
}

/** The cog button that opens and closes the settings menu. */
function createSettingsButton(): HTMLButtonElement {
	const button = document.createElement('button')

	button.id = SETTINGS_BUTTON_ID
	button.type = 'button'
	button.innerHTML = ICON_SETTINGS

	button.dataset.tooltip = 'Table of contents settings'
	button.setAttribute('aria-label', 'Table of contents settings')
	button.setAttribute('aria-haspopup', 'menu')
	button.setAttribute('aria-controls', SETTINGS_MENU_ID)
	button.setAttribute('aria-expanded', 'false')

	keepDoubleClickInside(button)

	return button
}

/** The menu's header: its title and a close button, which hands focus back to the cog. */
function createMenuHeader(button: HTMLButtonElement): HTMLDivElement {
	const header = document.createElement('div')
	header.className = 'md-toc-menu-header'

	const heading = document.createElement('span')
	heading.textContent = 'Settings'

	const closeBtn = document.createElement('button')
	closeBtn.type = 'button'
	closeBtn.className = 'md-toc-menu-close'
	closeBtn.innerHTML = ICON_CLOSE
	closeBtn.dataset.tooltip = 'Close settings'
	closeBtn.setAttribute('aria-label', 'Close settings')
	closeBtn.addEventListener('click', () => {
		closeSettingsMenu()
		button.focus()
	})

	header.append(heading, closeBtn)

	return header
}

/** One setting's label and its options. The options are links that updateSettingsMenu points at the extension. */
function createSettingGroup(group: SettingGroup): [HTMLDivElement, HTMLDivElement] {
	const label = document.createElement('div')
	label.className = 'md-toc-menu-label'
	label.textContent = group.label

	const options = document.createElement('div')
	options.className = 'md-toc-menu-options'
	options.setAttribute('role', 'group')
	options.setAttribute('aria-label', group.label)

	for (const [value, text] of group.options) {
		const option = document.createElement('a')
		option.className = 'md-toc-menu-option'
		option.setAttribute('role', 'menuitemradio')
		option.dataset.key = group.key
		option.dataset.value = value
		option.textContent = text
		options.appendChild(option)
	}

	if (group.requires) {
		label.dataset.requires = group.requires
		options.dataset.requires = group.requires
	}

	return [label, options]
}

/** The link at the bottom that opens all of the extension's settings in VS Code. */
function createAllSettingLink(): HTMLAnchorElement {
	const allSettings = document.createElement('a')

	allSettings.className = 'md-toc-menu-link'
	allSettings.setAttribute('role', 'menuitem')
	allSettings.dataset.path = '/open-settings'
	allSettings.textContent = 'Open all settings…'

	return allSettings
}

/** The settings menu, hidden until the cog opens it. */
function createSettingsMenu(button: HTMLButtonElement): HTMLDivElement {
	const menu = document.createElement('div')
	menu.id = SETTINGS_MENU_ID
	menu.setAttribute('role', 'menu')
	menu.setAttribute('aria-label', 'Table of contents settings')
	menu.hidden = true

	keepDoubleClickInside(menu)

	menu.appendChild(createMenuHeader(button))

	for (const group of SETTING_GROUPS) {
		menu.append(...createSettingGroup(group))
	}

	menu.appendChild(createAllSettingLink())

	return menu
}

/** Opens the menu, or closes it when it's open. A click with detail 0 comes from the keyboard (Enter or Space). */
function toggleSettingsMenu(e: MouseEvent): void {
	if (!isMenuOpen()) {
		openSettingsMenu(e.detail === 0)
	} else {
		closeSettingsMenu()
	}
}

/**
 * Picking an option applies it right away, here and in other open previews; the link itself
 * then goes to VS Code (via src/extension.ts) to save the setting. The menu stays open.
 */
function onOptionClick(e: MouseEvent): void {
	const option = e.target instanceof Element && e.target.closest<HTMLElement>('.md-toc-menu-option')

	if (!option) return

	if (option.getAttribute('aria-checked') === 'true') {
		// Already the current value: nothing to save.
		e.preventDefault()
		return
	}

	// Every option gets both from createSettingGroup.
	const key = option.dataset.key!
	const value = option.dataset.value!

	applySettingLocally(key, value)
	broadcastSetting(key, value)
}

/** Closes the menu when a pointer goes down anywhere outside it and the cog. */
function closeOnOutsidePointer(e: PointerEvent, menu: HTMLElement, button: HTMLElement): void {
	if (isMenuOpen() && e.target instanceof Node && !menu.contains(e.target) && !button.contains(e.target)) {
		closeSettingsMenu()
	}
}

/** Closes the menu on Escape, and hands focus back to the cog. */
function closeOnEscape(e: KeyboardEvent, button: HTMLElement): void {
	if (e.key === 'Escape' && isMenuOpen()) {
		closeSettingsMenu()
		button.focus()
	}
}

/** Whether a key and value are one of the menu's options, so a value read from storage can be trusted. */
function isMenuOption(key: unknown, value: unknown): boolean {
	return SETTING_GROUPS.some(group => group.key === key && group.options.some(([v]) => v === value))
}

/** Applies a choice made in another open preview, which reaches this one as a 'storage' event. */
function onLiveSetting(e: StorageEvent): void {
	if (e.key !== LIVE_SETTING_KEY || !e.newValue) return

	try {
		const { key, value } = JSON.parse(e.newValue)
		if (isMenuOption(key, value)) {
			applySettingLocally(key, value)
		}
	} catch {
		// Ignore malformed values.
	}
}

/** Adds the cog button and its settings menu, and handles choosing options and closing the menu. */
export function initSettings(): void {
	const button = createSettingsButton()
	const menu = createSettingsMenu(button)
	document.body.append(button, menu)

	button.addEventListener('click', e => toggleSettingsMenu(e))
	menu.addEventListener('click', onOptionClick)
	document.addEventListener('pointerdown', e => closeOnOutsidePointer(e, menu, button), true)
	document.addEventListener('keydown', e => closeOnEscape(e, button))
	window.addEventListener('storage', onLiveSetting)
}

/**
 * Refresh button next to the cog. Like the settings menu it's a vscode:// link: src/extension.ts
 * runs the built-in "Markdown: Refresh Preview", which re-renders all previews from the source.
 */
export function initRefresh(): void {
	const button = document.createElement('a')
	button.id = REFRESH_BUTTON_ID
	button.setAttribute('role', 'button')
	button.dataset.tooltip = 'Refresh preview'
	button.innerHTML = ICON_REFRESH
	button.setAttribute('aria-label', 'Refresh preview')
	keepDoubleClickInside(button)

	// The icon spins until the refresh replaces the page, and a page that a click just refreshed finishes the turn.
	button.addEventListener('click', () => {
		// The finishing turn from the last refresh would otherwise win over the spin.
		button.classList.remove('md-toc-refreshed')
		button.classList.add('md-toc-refreshing')
		writeStored(REFRESH_CLICK_KEY, String(Date.now()))
	})
	const sinceClick = Date.now() - Number(readStored(REFRESH_CLICK_KEY))
	if (sinceClick < REFRESH_SPIN_MS) {
		// Starts the last turn where the old page's spin would be by now, so it looks like one spin.
		const angle = ((sinceClick % REFRESH_TURN_MS) / REFRESH_TURN_MS) * 360
		button.style.setProperty('--md-toc-spin-from', `${Math.round(angle)}deg`)
		button.classList.add('md-toc-refreshed')
	}
	// Only once: the animation would play again whenever the button reappears, e.g. when the sidebar is shown.
	button.addEventListener('animationend', () => button.classList.remove('md-toc-refreshed'))

	document.body.appendChild(button)
}

/** Closes the settings menu if it's open, hiding it once its closing animation has played. */
export function closeSettingsMenu(): void {
	const menu = document.getElementById(SETTINGS_MENU_ID)
	if (!menu || !isMenuOpen()) return

	document.getElementById(SETTINGS_BUTTON_ID)!.setAttribute('aria-expanded', 'false')
	menu.classList.add(CLOSING_CLASS)

	const hide = (): void => {
		// Not when the menu was opened again meanwhile.
		if (menu.classList.contains(CLOSING_CLASS)) {
			menu.classList.remove(CLOSING_CLASS)
			menu.hidden = true
		}
	}
	// No animation runs with reduced motion, so there's nothing to wait for.
	if (menu.getAnimations().length === 0) {
		hide()
	} else {
		menu.addEventListener('animationend', hide, { once: true })
	}
}

/** Points the menu's links (and the refresh button's) at the extension, and marks the current values. */
export function updateSettingsMenu(): void {
	const config = document.getElementById(CONFIG_ELEMENT_ID)
	const menu = document.getElementById(SETTINGS_MENU_ID)

	if (!menu || !config) return

	const uriBase = config.dataset.uriBase || ''
	document.getElementById(REFRESH_BUTTON_ID)?.setAttribute('href', uriBase + '/refresh')

	for (const option of menu.querySelectorAll<HTMLElement>('.md-toc-menu-option')) {
		const key = option.dataset.key!
		const value = option.dataset.value!
		const href = uriBase + '/set?' + new URLSearchParams({ [key]: value })
		if (option.getAttribute('href') !== href) {
			option.setAttribute('href', href)
		}
		option.setAttribute('aria-checked', String(config.dataset[key] === value))
	}
	// Groups that only work with another setting are hidden while it's off.
	for (const element of menu.querySelectorAll<HTMLElement>('[data-requires]')) {
		element.hidden = config.dataset[element.dataset.requires!] !== 'true'
	}

	const allSettings = menu.querySelector<HTMLElement>('.md-toc-menu-link')!
	allSettings.setAttribute('href', uriBase + allSettings.dataset.path)
}
