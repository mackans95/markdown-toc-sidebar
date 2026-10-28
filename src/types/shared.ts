/**
 * The two links to a heading that the right-click menu copies: its anchor, and a Markdown link to it.
 */
export interface HeadingLinks {
	link: string
	markdownLink: string
}

/**
 * The data-vscode-context of a right-clicked heading: src/preview/toc/headings.ts writes it,
 * and the copy commands in src/extension.ts read it.
 */
export interface HeadingContext extends HeadingLinks {
	headingText: string
}
