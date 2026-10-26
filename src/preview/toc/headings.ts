// The document's headings, and the links to them that the right-click menu copies.
import { HEADING_SELECTOR } from './dom.ts';

// Prefix for ids we give headings written as HTML. They only exist in the preview, so a link to
// one wouldn't work anywhere else.
const RAW_ID_PREFIX = 'md-toc-raw-';

/**
 * What the context menu's copy commands put on the clipboard: the heading's anchor, and a Markdown
 * link to it. Brackets and backslashes in the text are escaped so they don't end the link text.
 */
export function headingLinks(id: string, text: string): { link: string; markdownLink: string } {
	const link = '#' + id;
	return { link, markdownLink: `[${text.replace(/[\\[\]]/g, '\\$&')}](${link})` };
}

/**
 * Headings written as HTML (<h2>…</h2>) get no id from the preview, so nothing could link to them.
 * Runs before every build: if the preview replaces such a heading while updating, the id is gone,
 * and the update's own rebuild puts it back. Setting an attribute doesn't trigger the sidebar's
 * MutationObserver, which only watches the content and the text.
 */
export function assignRawHeadingIds(): void {
	let n = 0;
	for (const heading of document.querySelectorAll('.markdown-body :is(h1, h2, h3, h4, h5, h6):not([id])')) {
		let id;
		do {
			id = RAW_ID_PREFIX + ++n;
		} while (document.getElementById(id));
		heading.id = id;
	}
}

/**
 * Right-clicking a heading, in the sidebar or the document, offers to copy a link to it: VS Code
 * shows the "webview/context" menu items from package.json for the element's data-vscode-context,
 * and passes that data to the commands in src/extension.ts. Headings written as HTML get none, as
 * their ids only exist in the preview. In the sidebar, VS Code's own Cut/Copy/Paste are left out.
 */
export function setHeadingMenuContext(element: HTMLElement, id: string, text: string, inSidebar: boolean): void {
	if (id.startsWith(RAW_ID_PREFIX)) {
		delete element.dataset.vscodeContext;
		return;
	}
	const context = JSON.stringify({
		webviewSection: 'mdTocHeading',
		headingText: text,
		...headingLinks(id, text),
		...(inSidebar ? { preventDefaultContextMenuItems: true } : {}),
	});
	if (element.dataset.vscodeContext !== context) {
		element.dataset.vscodeContext = context;
	}
}

/**
 * Gives the document's headings the right-click menu's data (see setHeadingMenuContext).
 * Like assignRawHeadingIds, runs before every build in case the preview replaced a heading.
 */
export function setDocumentHeadingMenuContexts(): void {
	for (const heading of document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)) {
		setHeadingMenuContext(heading, heading.id, heading.textContent.trim(), false);
	}
}
