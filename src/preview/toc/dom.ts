// The elements the sidebar adds to the preview, and what the code creating them shares.
export const NAV_ID = 'md-toc-sidebar'
export const TOGGLE_ID = 'md-toc-toggle'
export const RESIZER_ID = 'md-toc-resizer'
export const SETTINGS_BUTTON_ID = 'md-toc-settings-button'
export const SETTINGS_MENU_ID = 'md-toc-settings-menu'
export const REFRESH_BUTTON_ID = 'md-toc-refresh-button'

// Everything above, so changes inside our own UI can be told apart from the preview's.
export const OWN_UI_SELECTOR = [NAV_ID, TOGGLE_ID, RESIZER_ID, SETTINGS_BUTTON_ID, SETTINGS_MENU_ID, REFRESH_BUTTON_ID]
	.map(id => '#' + id)
	.join(', ')

// The document's headings that can be linked to; assignRawHeadingIds gives the others an id first.
export const HEADING_SELECTOR = '.markdown-body :is(h1, h2, h3, h4, h5, h6)[id]'

/**
 * A double-click in the preview can jump to the editor; our UI shouldn't trigger that.
 * Stopping it on the element itself (not at the document) still lets the element's own
 * dblclick handlers run first.
 */
export function keepDoubleClickInside(element: HTMLElement): void {
	element.addEventListener('dblclick', event => event.stopPropagation())
}
