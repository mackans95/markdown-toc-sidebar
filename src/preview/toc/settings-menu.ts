// Settings menu behind the cog button. Its options are vscode:// links: the preview can't change
// VS Code settings itself, so VS Code hands those links to src/extension.ts, which updates the
// setting and refreshes the preview (which then shows the new value here).
import { CONFIG_ELEMENT_ID } from '../../shared/constants.ts'
import { writeStored } from '../storage.ts'
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
]

// Other open previews share this page's storage, so a key written here reaches them as a
// 'storage' event. That lets a choice from the menu show up everywhere without a reload.
const LIVE_SETTING_KEY = 'md-toc-sidebar.live-setting'

/** Opens the menu; from the keyboard, focuses the current value. */
function openSettingsMenu(fromKeyboard: boolean) {
	const menu = document.getElementById(SETTINGS_MENU_ID)!
	menu.hidden = false
	document.getElementById(SETTINGS_BUTTON_ID)!.setAttribute('aria-expanded', 'true')
	if (fromKeyboard) {
		menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
	}
}

/** Applies a setting to this preview right away through the config element, before VS Code has saved it. */
function applySettingLocally(key: string, value: string) {
	const config = document.getElementById(CONFIG_ELEMENT_ID)
	if (config) {
		config.dataset[key] = value
		sidebar.scheduleBuild()
	}
}

/** Tells the other open previews about a setting chosen here (see LIVE_SETTING_KEY). */
function broadcastSetting(key: string, value: string) {
	// The timestamp makes every write a change, so repeated choices still fire the event.
	writeStored(LIVE_SETTING_KEY, JSON.stringify({ key, value, time: Date.now() }))
}

/** The cog button that opens and closes the settings menu. */
function createSettingsButton(): HTMLButtonElement {
	const button = document.createElement('button')

	button.id = SETTINGS_BUTTON_ID
	button.type = 'button'
	button.innerHTML = ICON_SETTINGS
	button.title = 'Table of contents settings'

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
	closeBtn.title = 'Close'
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
function toggleSettingsMenu(menu: HTMLElement, event: MouseEvent): void {
	if (menu.hidden) {
		openSettingsMenu(event.detail === 0)
	} else {
		closeSettingsMenu()
	}
}

/**
 * Picking an option applies it right away, here and in other open previews; the link itself
 * then goes to VS Code (via src/extension.ts) to save the setting. The menu stays open.
 */
function onOptionClick(event: MouseEvent): void {
	const option = event.target instanceof Element && event.target.closest<HTMLElement>('.md-toc-menu-option')

	if (!option) return

	if (option.getAttribute('aria-checked') === 'true') {
		// Already the current value: nothing to save.
		event.preventDefault()
		return
	}

	// Every option gets both from createSettingGroup.
	const key = option.dataset.key!
	const value = option.dataset.value!

	applySettingLocally(key, value)
	broadcastSetting(key, value)
}

/** Closes the menu when a pointer goes down anywhere outside it and the cog. */
function closeOnOutsidePointer(event: PointerEvent, menu: HTMLElement, button: HTMLElement): void {
	if (
		!menu.hidden &&
		event.target instanceof Node &&
		!menu.contains(event.target) &&
		!button.contains(event.target)
	) {
		closeSettingsMenu()
	}
}

/** Closes the menu on Escape, and hands focus back to the cog. */
function closeOnEscape(event: KeyboardEvent, menu: HTMLElement, button: HTMLElement): void {
	if (event.key === 'Escape' && !menu.hidden) {
		closeSettingsMenu()
		button.focus()
	}
}

/** Whether a key and value are one of the menu's options, so a value read from storage can be trusted. */
function isMenuOption(key: unknown, value: unknown): boolean {
	return SETTING_GROUPS.some(group => group.key === key && group.options.some(([v]) => v === value))
}

/** Applies a choice made in another open preview, which reaches this one as a 'storage' event. */
function onLiveSetting(event: StorageEvent): void {
	if (event.key !== LIVE_SETTING_KEY || !event.newValue) return

	try {
		const { key, value } = JSON.parse(event.newValue)
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

	button.addEventListener('click', e => toggleSettingsMenu(menu, e))
	menu.addEventListener('click', onOptionClick)
	document.addEventListener('pointerdown', e => closeOnOutsidePointer(e, menu, button), true)
	document.addEventListener('keydown', e => closeOnEscape(e, menu, button))
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
	button.innerHTML = ICON_REFRESH
	button.title = 'Refresh preview'
	button.setAttribute('aria-label', 'Refresh preview')
	keepDoubleClickInside(button)
	document.body.appendChild(button)
}

/** Closes the settings menu if it's open. */
export function closeSettingsMenu(): void {
	const menu = document.getElementById(SETTINGS_MENU_ID)
	if (menu && !menu.hidden) {
		menu.hidden = true
		document.getElementById(SETTINGS_BUTTON_ID)!.setAttribute('aria-expanded', 'false')
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
	const allSettings = menu.querySelector<HTMLElement>('.md-toc-menu-link')!
	allSettings.setAttribute('href', uriBase + allSettings.dataset.path)
}
