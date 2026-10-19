// The button that hides the sidebar for the full width, and brings it back. The hidden state is
// remembered for all previews of the same kind.
import { readStored, writeStored } from '../storage.ts';
import { resetActive, updateActive } from './active.ts';
import { sidebarPosition } from './config.ts';
import { keepDoubleClickInside, NAV_ID, TOGGLE_ID } from './dom.ts';
import { ICON_HIDE_LEFT, ICON_HIDE_RIGHT, ICON_SHOW } from './icons.ts';
import { closeSettingsMenu } from './settings-menu.ts';

// 'collapsed', in the storage key and the body's class, is the sidebar being hidden.
const HIDDEN_KEY = 'md-toc-sidebar.collapsed';
const HIDDEN_CLASS = 'md-toc-collapsed';

export function readHidden(): boolean {
	return readStored(HIDDEN_KEY) === 'true';
}

function writeHidden(hidden: boolean) {
	writeStored(HIDDEN_KEY, String(hidden));
}

function getToggle() {
	let toggle = document.getElementById(TOGGLE_ID);
	if (!toggle) {
		toggle = document.createElement('button');
		toggle.id = TOGGLE_ID;
		toggle.setAttribute('type', 'button');
		toggle.setAttribute('aria-controls', NAV_ID);
		keepDoubleClickInside(toggle);
		toggle.addEventListener('click', () => setSidebarHidden(!document.body.classList.contains(HIDDEN_CLASS)));
		// Sits outside the nav so it stays visible while the sidebar is hidden.
		document.body.appendChild(toggle);
	}
	return toggle;
}

export function setSidebarHidden(hidden: boolean): void {
	resetActive();
	document.body.classList.toggle(HIDDEN_CLASS, hidden);
	updateToggle();
	closeSettingsMenu();
	writeHidden(hidden);
	if (!hidden) {
		updateActive();
	}
}

export function updateToggle(): void {
	const hidden = document.body.classList.contains(HIDDEN_CLASS);
	const toggle = getToggle();
	const label = hidden ? 'Show table of contents' : 'Hide table of contents';
	const icon = hidden ? 'show' : sidebarPosition() === 'left' ? 'hide-left' : 'hide-right';
	// Compare by name: the browser re-serializes innerHTML, so comparing markup never matches,
	// and replacing the icon on every update would swallow clicks on the button.
	if (toggle.dataset.icon !== icon) {
		toggle.dataset.icon = icon;
		toggle.innerHTML = icon === 'show' ? ICON_SHOW : icon === 'hide-left' ? ICON_HIDE_LEFT : ICON_HIDE_RIGHT;
	}
	toggle.title = label;
	toggle.setAttribute('aria-label', label);
	toggle.setAttribute('aria-expanded', String(!hidden));
}
