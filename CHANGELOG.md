# Changelog

## Unreleased

- A preview whose tab comes back from the background now shows the edits you made before it went there, instead of how it was last fully rendered.
- A choice from the cog menu now also reaches previews in background tabs, and a preview editor and a side preview that are both on screen, without a manual refresh.
- Refreshing, with the sidebar's refresh button or by changing a setting in the Settings editor, no longer moves previews in background tabs away from where you were.

## 0.2.1

- Now also published on [Open VSX](https://open-vsx.org/extension/mackans95/markdown-toc-sidebar), for VSCodium, Cursor, Windsurf and other editors that use it.
- No changes to how the extension works. Under the hood, its code is now TypeScript in separate modules, built with esbuild and checked with Oxlint and Oxfmt.

## 0.2.0

- `markdownTocSidebar.maxDepth` setting to list headings only down to a chosen level.
- `markdownTocSidebar.topHeading` setting to show a document's single `#` title as a title above the list, with the sections listed from the top level.
- `markdownTocSidebar.numbering` setting to number the entries by their place in the outline, like `1`, `1.1` and `1.2`.
- `markdownTocSidebar.collapsible` setting for arrows that collapse and expand sections. Collapsed sections are remembered for each file.
- All new settings are in the cog menu too. The menu now opens next to the sidebar instead of over it, so you can see each change in the list.
- Right-click an entry, or a heading in the document, to copy a link to it: *Copy Link to Heading* or *Copy Markdown Link to Heading*.
- Headings written as HTML, like `<h2>`, are listed.
- Keyboard navigation: the list is a single Tab stop that lands on the current section; the arrow keys, `Home` and `End` move within it, and `Left`/`Right` also collapse and expand sections.
- The current entry is announced to screen readers (`aria-current`).
- Refresh button in the sidebar's header that re-renders the preview from the file (VS Code's *Markdown: Refresh Preview*).
- The sidebar's "Contents" title no longer wraps onto several lines when the sidebar is narrow; it's hidden instead.
- Works in vscode.dev and github.dev.
- Requires VS Code 1.82 or later (was 1.80).

## 0.1.1

- The preview keeps its scroll position when you switch to another tab and back, instead of jumping back to where it was when it was opened.

## 0.1.0

Initial release.

- Table of contents sidebar in the built-in Markdown preview, both side-by-side and in the Markdown Preview editor.
- Nested entries for `h1`–`h6`, updated live as you edit.
- Click an entry to scroll to its heading, which flashes briefly to show where you landed.
- `markdownTocSidebar.scrollBehavior` setting to choose between a smooth scroll (default) and an instant jump.
- `markdownTocSidebar.position` setting to show the sidebar on the right (default) or left.
- Cog menu in the sidebar's header for changing the settings without opening VS Code's Settings.
- The current section is highlighted while scrolling, with the sections it belongs to highlighted more lightly.
- Button to hide and show the sidebar.
- Drag the sidebar's edge to resize it; double-click to reset, or use the arrow keys.
- Sidebar width and hidden/shown state are remembered.
- Smoother scrolling when the preview follows the editor.
