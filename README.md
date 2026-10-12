# Markdown TOC Sidebar

Adds a table of contents sidebar to VS Code's built-in Markdown preview, built from the headings in your document. It only reads the rendered preview and never changes your Markdown files.

![Clicking through the table of contents, scrolling, resizing and hiding the sidebar](images/demo.gif)

## Features

- **Table of contents for every preview.** Headings `h1`–`h6` are listed and nested by level. There's nothing to configure and no command to run.
- **Live updates.** Add, rename or remove a heading and the sidebar updates as you type.
- **Click to jump.** Clicking an entry smoothly scrolls the preview to that heading, leaving a little space above it, and the heading flashes briefly so you can see where you landed. Prefer an instant jump? See [Settings](#settings).
- **Current section highlight.** The entry for the section you're reading is highlighted as you scroll, and the list keeps it in view. The sections it belongs to are highlighted more lightly, so you can see where you are in the structure.
- **Hide and show.** The button in the sidebar's top-right corner hides it when you want the full width, and brings it back.
- **Resizable.** Drag the sidebar's left edge to change its width, or double-click the edge to reset it. With the edge focused, the arrow keys work too.
- **Remembered.** The width and the hidden/shown choice carry over to every preview, including after restarting VS Code.
- **Smoother scroll sync.** When you scroll the editor, the preview glides to its new position instead of jumping.
- **Matches your theme.** The sidebar uses your color theme's colors.

## Usage

Install the extension and open any Markdown file as a preview. The sidebar appears automatically in:

- **Markdown: Open Preview to the Side** (`Ctrl+K V`, or `Cmd+K V` on macOS)
- **Markdown: Open Preview** (`Ctrl+Shift+V`, or `Cmd+Shift+V` on macOS)
- The **Markdown Preview** editor (*Open as Preview* in the editor toolbar)

![Editor and preview side by side, with the current section highlighted in the sidebar](images/side-by-side.png)

![The Markdown Preview editor with the sidebar](images/markdown-preview.png)

If the preview is very narrow (under 360px), the sidebar hides itself so the document keeps enough room.

## Settings

| Setting | Default | Description |
|---|---|---|
| `markdownTocSidebar.scrollBehavior` | `smooth` | How the preview scrolls when you click an entry: `smooth` animates the scroll, `instant` jumps straight there. When your system is set to reduce motion, it always jumps instantly. |

Changes apply to open previews right away.

## Tips

These are VS Code settings, not settings of this extension:

- **Double-click a heading to jump to it in the source.** Turn on `markdown.preview.doubleClickToSwitchToEditor`. Double-clicks inside the sidebar never jump to the editor.
- **Smoother scrolling in the other direction.** This extension smooths the preview when you scroll the editor. To also smooth the editor when you scroll the preview, turn on `editor.smoothScrolling`. Note that this also animates normal mouse-wheel scrolling in the editor.

## Requirements

VS Code 1.80 or later. The extension only adds to the built-in Markdown preview, so it doesn't work with other preview extensions such as Markdown Preview Enhanced.

## Known limitations

- Only Markdown headings (`#`, `##`, …) are listed. Headings written as raw HTML, like `<h2>`, are not.
- The sidebar width and the hidden/shown state are shared by all previews rather than saved per file.

## Privacy

The extension has no telemetry and makes no network requests.

## How it works

The extension uses VS Code's Markdown preview extension points (`markdown.previewScripts`, `markdown.previewStyles` and `markdown.markdownItPlugins`).

- `media/toc.js` builds the sidebar from the rendered headings, which already have `id`s, and rebuilds it whenever the preview content changes.
- `media/smooth-scroll-sync.js` takes over the preview's scroll-sync jumps and animates them instead.
- `media/toc.css` styles the sidebar using your theme's colors.
- `src/extension.js` passes the extension's settings to the preview, which can't read VS Code settings itself. It adds a hidden element carrying the settings to each rendered preview, and refreshes open previews when a setting changes.

## Development

1. Clone the repository and open it in VS Code.
2. Press `F5` to open a test window with the extension loaded and `sample.md` open.
3. Open the preview with `Cmd+K V` / `Ctrl+K V`.

There are two launch configurations. **Run Extension (no other extensions)** disables your installed extensions in the test window, so the Debug Console only shows output from this extension and VS Code's built-ins.

The extension has no build step. After editing a file in `media/`, run **Developer: Reload Window** in the test window to load the change.

## License

[MIT](LICENSE)
