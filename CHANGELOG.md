# Changelog

## Unreleased

- Refresh button in the sidebar's header that re-renders the preview from the file (VS Code's *Markdown: Refresh Preview*).
- The sidebar's "Contents" title no longer wraps onto several lines when the sidebar is narrow; it's hidden instead.

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
