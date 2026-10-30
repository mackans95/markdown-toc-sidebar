# Markdown TOC Sidebar

Adds a table of contents sidebar to VS Code's built-in Markdown preview, built from the headings in your document and drawn in your color theme's colors. It only reads the rendered preview and never changes your Markdown files.

![Clicking through the table of contents, scrolling the editor, resizing and hiding the sidebar, and moving it to the left from the settings menu](images/demo.gif)

## Features

- **Works right away.** Every preview lists its headings `h1`–`h6`, nested by level, including headings written as HTML like `<h2>`, and updates as you type. It works in [vscode.dev](https://vscode.dev) and [github.dev](https://github.dev) too.
- **Click to jump.** Clicking an entry scrolls the preview to that heading, smoothly or instantly, and the heading flashes briefly so you can see where you landed.
- **Know where you are.** The section you're reading is highlighted as you scroll and kept in view, and the sections it belongs to are highlighted more lightly.
- **Fold long outlines.** Fold a section with the arrow next to it, or all of them with the Fold All button in the header. With auto-collapse, the list folds as you read, so only the section you're in stays open. Folded sections are remembered for each file.
- **Shape the list.** Choose how deep it goes, show a single `#` title above the list, number the entries like `1.1`, show indent guides, and put the sidebar on the left or right. See [Settings](#settings).
- **Copy a link to a heading.** Right-click an entry, or a heading in the document, for _Copy Link to Heading_ (`#getting-started`) or _Copy Markdown Link to Heading_ (`[Getting Started](#getting-started)`). The anchors are the ones GitHub uses, so the links work there too.
- **Keyboard friendly.** The list is a single Tab stop that lands on the section you're reading. Move with the arrow keys, `Home` and `End`; `Left` and `Right` also fold and unfold sections.
- **Out of your way.** Hide the sidebar with the arrow in its header, or drag its edge to resize it, and it remembers both. The cog opens a [settings menu](#changing-settings-from-the-sidebar) next to the sidebar, and the refresh button re-renders the preview. Every button has a tooltip, and entries that are cut off show in full when you hover over them.
- **Better preview scrolling.** The preview glides instead of jumping when you scroll the editor, and stays where you left it when you switch tabs and come back.

## Install

- **VS Code:** search for **Markdown TOC Sidebar** in the Extensions view, or install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mackans95.markdown-toc-sidebar).
- **VSCodium, Cursor, Windsurf and other editors that use Open VSX:** search for **Markdown TOC Sidebar** in the Extensions view, or install it from [Open VSX](https://open-vsx.org/extension/mackans95/markdown-toc-sidebar).
- **From a file:** download the `.vsix` from a [GitHub release](https://github.com/mackans95/markdown-toc-sidebar/releases) and run `code --install-extension markdown-toc-sidebar-<version>.vsix`.

## Usage

Install the extension and open any Markdown file as a preview. The sidebar appears automatically in:

- **Markdown: Open Preview to the Side** (`Ctrl+K V`, or `Cmd+K V` on macOS)
- **Markdown: Open Preview** (`Ctrl+Shift+V`, or `Cmd+Shift+V` on macOS)
- The **Markdown Preview** editor (*Open as Preview* in the editor toolbar)

![Editor and preview side by side, with the current section and its parent sections highlighted in the sidebar](images/side-by-side.png)

If the preview is very narrow (under 360px), the sidebar hides itself so the document keeps enough room.

## Settings

| Setting | Default | Description |
|---|---|---|
| `markdownTocSidebar.scrollBehavior` | `smooth` | How the preview scrolls when you click an entry: `smooth` animates the scroll, `instant` jumps straight there. When your system is set to reduce motion, it always jumps instantly. |
| `markdownTocSidebar.position` | `right` | Which side of the preview the sidebar is shown on: `left` or `right`. |
| `markdownTocSidebar.maxDepth` | `6` | The deepest heading level listed, from `1` (only `#` headings) to `6` (all headings). The document's top level is always listed, even when it's deeper than this. |
| `markdownTocSidebar.topHeading` | `list` | How to show a document's single top heading, such as a `#` title above `##` sections: `list` lists it as the first entry, `title` shows it as a title above the list. Only applies when the first heading is the only one at the document's top level. |
| `markdownTocSidebar.numbering` | `false` | Number the entries by their place in the outline, like `1`, `1.1` and `1.2`. |
| `markdownTocSidebar.collapsible` | `false` | Show arrows that collapse and expand the sections under an entry. Collapsed sections are remembered for each file. |
| `markdownTocSidebar.autoCollapse` | `false` | Fold sections away as you read, so only the section you're in and the sections containing it stay open. Needs `collapsible`. |
| `markdownTocSidebar.scrollbar` | `visible` | How to show the list's scrollbar when it's too long to fit: `visible` always, beside the entries; `hover` on top of the entries while the pointer is over the sidebar, so it takes no space; `hidden` never. The list still scrolls with the mouse wheel, touchpad and keyboard. |
| `markdownTocSidebar.indentGuides` | `auto` | Vertical lines that show which entries belong to which section: `auto` follows VS Code's `workbench.tree.renderIndentGuides`, like the Explorer; `onHover` shows them while the pointer is over the sidebar; `always`; or `none`. |

You can change these from the cog menu in the sidebar, or in VS Code's Settings (search for "Markdown TOC Sidebar"). Either way, open previews update right away.

### Changing settings from the sidebar

Click the **cog** in the sidebar's header to open the settings menu next to the sidebar. A choice takes effect right away in all open previews, and the menu stays open until you close it with its **×** button, click outside it, or press `Escape`.

![The settings menu, opened next to the sidebar from the cog in its header](images/settings-menu.png)

The first time you change a setting from the menu, VS Code asks _"Allow 'Markdown TOC Sidebar' extension to open this URI?"_. Tick **Do not ask me again for this extension** and click **Open**, and it won't ask again.

![VS Code's permission prompt, with "Do not ask me again for this extension" ticked](images/allow-uri-prompt.png)

VS Code asks because the preview can't change settings by itself. Each option in the menu is a `vscode://` link to this extension, which only uses these links to update its own settings, open the Settings editor and refresh the preview. If you click **Cancel**, the setting isn't saved, and the preview goes back to the saved setting the next time it reloads.

## Tips

These are VS Code settings, not settings of this extension:

- **Double-click a heading to jump to it in the source.** Turn on `markdown.preview.doubleClickToSwitchToEditor`. Double-clicks inside the sidebar never jump to the editor.
- **Smoother scrolling in the other direction.** This extension smooths the preview when you scroll the editor. To also smooth the editor when you scroll the preview, turn on `editor.smoothScrolling`. Note that this also animates normal mouse-wheel scrolling in the editor.

## Requirements

VS Code 1.82 or later. The extension only adds to the built-in Markdown preview, so it doesn't work with other preview extensions such as Markdown Preview Enhanced.

## Known limitations

- The sidebar width and the hidden/shown state are saved per kind of preview (side-by-side, or the Markdown Preview editor), not per file. Collapsed sections are saved per file, but also separately for each kind of preview.
- Headings written as HTML, like `<h2>`, are listed, but have no *Copy Link to Heading*: the anchor the sidebar gives them only exists in the preview, so a link to it wouldn't work anywhere else. Give the heading its own `id`, like `<h2 id="setup">`, and both copy items work for it.

## Privacy

The extension has no telemetry and makes no network requests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the extension works, how to run it from source, and how releases are made.

## License

[MIT](LICENSE)
