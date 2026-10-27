// Runs inside VS Code's built-in Markdown preview webview.
// Builds a table of contents from the rendered headings and keeps it in sync.
import { OWN_UI_SELECTOR } from './dom.ts'
import { initResizer } from './resizer.ts'
import { scrolling } from './scroll.ts'
import { initRefresh, initSettings } from './settings-menu.ts'
import { sidebar } from './sidebar.ts'
import { readHidden, setSidebarHidden } from './toggle.ts'

/** The only code that runs when the script loads; the other files just define functions. */
function start() {
	scrolling.init()

	// Our script loads async, so the preview content may arrive before or after we run.
	// Watching the DOM catches the initial render and every later update regardless of timing.
	// Changes inside our own UI (sidebar, buttons, menu) are ignored, or updating it would loop.
	new MutationObserver(records => {
		const isOwnUi = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest(OWN_UI_SELECTOR)
		if (records.some(r => !isOwnUi(r.target))) {
			sidebar.scheduleBuild()
		}
	}).observe(document.body, { childList: true, subtree: true, characterData: true })

	// Fired by the built-in preview after it patches in new content.
	window.addEventListener('vscode.markdown.updateContent', () => sidebar.scheduleBuild())

	initResizer()
	initSettings()
	initRefresh()
	setSidebarHidden(readHidden())
	sidebar.scheduleBuild()
}

// Protects the script from running twice on the same page, no double initialization.
if (!window.__mdTocSidebarInitialized) {
	window.__mdTocSidebarInitialized = true
	start()
}
