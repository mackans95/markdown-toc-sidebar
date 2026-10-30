# Changelog

## Unreleased

- `markdownTocSidebar.indentGuides` setting, also in the cog menu, for vertical lines that show which entries belong to which section. By default they follow VS Code's own `workbench.tree.renderIndentGuides`, so they show on hover like in the Explorer, and you can turn them on or off for the sidebar alone.
- `markdownTocSidebar.autoCollapse` setting, also in the cog menu, to fold sections away as you read, so only the section you're in and the sections containing it stay open. It works with collapsible sections, and leaves the sections you've folded yourself as they were for when you turn it off.
- With collapsible sections on, a new header button next to refresh folds every section at once, and unfolds them all again once everything you can see is folded ([#17](https://github.com/mackans95/markdown-toc-sidebar/issues/17)).
- Entries whose text is cut off show it in full in a tooltip when you hover over them, and the collapse arrows and the resize edge now have tooltips like the header buttons.

## 0.3.0

- `markdownTocSidebar.scrollbar` setting, also in the cog menu, to show the list's scrollbar only on top of the entries while the pointer is over the sidebar, so it takes no space, or not at all ([#7](https://github.com/mackans95/markdown-toc-sidebar/issues/7)).
- A preview whose tab comes back from the background now shows the edits you made before it went there, instead of how it was last fully rendered.
- A choice from the cog menu now also reaches previews in background tabs, and a preview editor and a side preview that are both on screen, without a manual refresh.
- Refreshing, with the sidebar's refresh button or by changing a setting in the Settings editor, no longer moves previews in background tabs away from where you were.
- The settings menu grows out of the cog when it opens and shrinks back into it when it closes, and the cog makes a quarter turn while the menu is open.
- The refresh icon spins while the preview refreshes.
- The arrows of collapsible sections turn instead of jumping, and the header buttons fade their hover background in.
- The header buttons and the menu's close button show a tooltip with what they do.
- With your system set to reduce motion, nothing moves or turns.
- Only the list scrolls now, below the header, so its rounded scrollbar runs beside the entries instead of past the header buttons. Scrolling over the sidebar no longer scrolls the document, also not at the end of the list.

## 0.2.1

- Now also published on [Open VSX](https://open-vsx.org/extension/mackans95/markdown-toc-sidebar), for VSCodium, Cursor, Windsurf and other editors that use it.
- No changes to how the extension works. Under the hood, its code is now TypeScript in separate modules, built with esbuild and checked with Oxlint and Oxfmt.

## 0.2.0

- `markdownTocSidebar.maxDepth` setting to list headings only down to a chosen level.
- `markdownTocSidebar.topHeading` setting to show a document's single `#` title as a title above the list, with the sections listed from the top level.
- `markdownTocSidebar.numbering` setting to number the entries by their place in the outline, like `1`, `1.1` and `1.2`.
- `markdownTocSidebar.collapsible` setting for arrows that collapse and expand sections. Collapsed sections are remembered for each file.
- All new settings are in the cog menu too. The menu now opens next to the sidebar instead of over it, so you can see each change in the list.
- Right-click an entry, or a heading in the document, to copy a link to it: _Copy Link to Heading_ or _Copy Markdown Link to Heading_.
- Headings written as HTML, like `<h2>`, are listed.
- Keyboard navigation: the list is a single Tab stop that lands on the current section; the arrow keys, `Home` and `End` move within it, and `Left`/`Right` also collapse and expand sections.
- The current entry is announced to screen readers (`aria-current`).
- Refresh button in the sidebar's header that re-renders the preview from the file (VS Code's _Markdown: Refresh Preview_).
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
