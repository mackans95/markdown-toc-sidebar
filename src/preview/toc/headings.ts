// The document's headings, and the links to them that the right-click menu copies.

// What the context menu's copy commands put on the clipboard: the heading's anchor, and a Markdown
// link to it. Brackets and backslashes in the text are escaped so they don't end the link text.
export function headingLinks(id: string, text: string): { link: string; markdownLink: string } {
	const link = '#' + id;
	return { link, markdownLink: `[${text.replace(/[\\[\]]/g, '\\$&')}](${link})` };
}
