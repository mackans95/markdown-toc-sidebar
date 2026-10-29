// The extension's settings, as the config element in the preview carries them. src/extension.ts
// writes that element into every rendered preview, since only the extension can read VS Code settings.
import { CONFIG_ELEMENT_ID } from '../../shared/constants.ts'
import type { PreviewConfig } from '../../types/preview.ts'

// What each setting reads as until the config element is there; the same defaults as package.json.
const FALLBACKS: PreviewConfig = {
	scrollBehavior: 'smooth',
	position: 'right',
	maxDepth: '6',
	topHeading: 'list',
	numbering: 'false',
	collapsible: 'false',
	autoCollapse: 'false',
	scrollbar: 'visible',
}

/** Current value of a setting, or the fallback when the config element isn't there (yet). */
export function readConfig<K extends keyof PreviewConfig>(key: K): PreviewConfig[K] {
	const config = document.getElementById(CONFIG_ELEMENT_ID)
	// Only allowed values get here: src/extension.ts checks them (Settings.read), and the menu only applies its own option.
	const value = config?.dataset[key] as PreviewConfig[K] | undefined
	return value || FALLBACKS[key]
}

/** 'smooth' or 'instant', from the markdownTocSidebar.scrollBehavior setting. */
export function scrollBehavior(): 'smooth' | 'instant' {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return 'instant'
	}
	return readConfig('scrollBehavior')
}

/** 'left' or 'right', from the markdownTocSidebar.position setting. */
export function sidebarPosition(): 'left' | 'right' {
	return readConfig('position')
}
