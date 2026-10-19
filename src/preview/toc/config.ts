// The extension's settings, as the config element in the preview carries them. src/extension.ts
// writes that element into every rendered preview, since only the extension can read VS Code settings.
import { CONFIG_ELEMENT_ID } from '../../shared/constants.ts';

// Current value of a setting, or the fallback when the config element isn't there (yet).
export function readConfig(key: string, fallback: string): string {
	const config = document.getElementById(CONFIG_ELEMENT_ID);
	return (config && config.dataset[key]) || fallback;
}

// 'smooth' or 'instant', from the markdownTocSidebar.scrollBehavior setting.
export function scrollBehavior(): 'smooth' | 'instant' {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return 'instant';
	}
	return readConfig('scrollBehavior', 'smooth') === 'instant' ? 'instant' : 'smooth';
}

// 'left' or 'right', from the markdownTocSidebar.position setting.
export function sidebarPosition(): 'left' | 'right' {
	return readConfig('position', 'right') === 'left' ? 'left' : 'right';
}
