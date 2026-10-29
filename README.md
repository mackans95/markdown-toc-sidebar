# Markdown TOC Sidebar

Adds a table of contents sidebar to VS Code's built-in Markdown preview, built from the headings in your document. It only reads the rendered preview and never changes your Markdown files.

![Clicking through the table of contents, scrolling the editor, resizing and hiding the sidebar, and moving it to the left from the settings menu](images/demo.gif)

## Features

- **Table of contents for every preview.** Headings `h1`–`h6` are listed and nested by level, including headings written as HTML, like `<h2>`. It works as soon as it's installed, with no command to run.
- **Live updates.** Add, rename or remove a heading and the sidebar updates as you type.
- **Click to jump.** Clicking an entry smoothly scrolls the preview to that heading, leaving a little space above it, and the heading flashes briefly so you can see where you landed. Prefer an instant jump? See [Settings](#settings).
- **Current section highlight.** The entry for the section you're reading is highlighted as you scroll, and the list keeps it in view. The sections it belongs to are highlighted more lightly, so you can see where you are in the structure.
- **As deep as you like.** List only the levels you want, for example just the `##` sections of a long document.
- **Title at the top.** A document with a single `#` title above its sections can show that title above the list, with the sections listed from the top.
- **Numbering.** Number the entries by their place in the outline, like `1`, `1.1` and `1.2`. Only the sidebar is numbered, not your document.
- **Collapsible sections.** Fold away the sections under an entry with the arrow next to it. What you collapse is remembered for each file.
- **Copy a link to a heading.** Right-click an entry, or a heading in the document, and pick *Copy Link to Heading* (`#getting-started`) or *Copy Markdown Link to Heading* (`[Getting Started](#getting-started)`). The anchors are the ones GitHub uses too, so the links also work there.
- **Keyboard friendly.** The whole list is a single Tab stop that lands on the section you're reading. Move with the arrow keys, `Home` and `End`; `Left` and `Right` go to the parent or the first sub-section, and collapse or expand sections that have arrows.
- **Hide and show.** The arrow button in the sidebar's header hides it when you want the full width, and brings it back.
- **Left or right.** Put the sidebar on whichever side of the preview you prefer.
- **Settings at hand.** The cog button in the sidebar's header opens a small menu next to the sidebar for the extension's settings, so you don't have to go to VS Code's Settings. VS Code asks for permission the first time; see [Changing settings from the sidebar](#changing-settings-from-the-sidebar).
- **Refresh button.** The circular arrow in the sidebar's header re-renders the preview from the file, the same as VS Code's *Markdown: Refresh Preview*. Useful when something the preview doesn't watch has changed, like a stylesheet. Like the settings menu, VS Code asks for permission the first time.
- **Resizable.** Drag the sidebar's inner edge to change its width, or double-click the edge to reset it. With the edge focused, the arrow keys work too.
- **Remembered.** The width and the hidden/shown choice carry over to other previews, including after restarting VS Code. VS Code keeps side-by-side previews and the Markdown Preview editor separate, so each of those remembers its own.
- **Smoother scroll sync.** When you scroll the editor, the preview glides to its new position instead of jumping.
- **Keeps your place.** Switch to another tab and back, and the preview is still where you left it. Without this, VS Code's preview often jumps back to where it was when it was opened, typically the top.
- **Matches your theme.** The sidebar uses your color theme's colors.
- **On the web too.** Works in [vscode.dev](https://vscode.dev) and [github.dev](https://github.dev) as well as in the desktop app.

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

![The Markdown Preview editor with the sidebar](images/markdown-preview.png)

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
| `markdownTocSidebar.scrollbar` | `visible` | How to show the list's scrollbar when it's too long to fit: `visible` always, beside the entries; `hover` on top of the entries while the pointer is over the sidebar, so it takes no space; `hidden` never. The list still scrolls with the mouse wheel, touchpad and keyboard. |

You can change these from the cog menu in the sidebar, or in VS Code's Settings (search for "Markdown TOC Sidebar"). Either way, open previews update right away.

### Changing settings from the sidebar

Click the **cog** in the sidebar's header to open the settings menu. It opens next to the sidebar, so you can see each change in the list as you make it. A choice takes effect immediately, and the menu stays open until you close it with its **×** button, click outside it, or press `Escape`.

![The settings menu, opened next to the sidebar from the cog in its header](images/settings-menu.png)

> **Heads-up: the first time you change a setting from this menu, VS Code asks for permission.** This happens only once:
>
> 1. Pick an option in the menu, for example **Left**.
> 2. VS Code asks: *"Allow 'Markdown TOC Sidebar' extension to open this URI?"*
> 3. Tick **Do not ask me again for this extension**.
> 4. Click **Open**.
>
> ![VS Code's permission prompt, with "Do not ask me again for this extension" ticked](images/allow-uri-prompt.png)
>
> The setting is saved. From then on, changes from the menu are saved without the question.

Other open previews of the same kind (side-by-side, or the Markdown Preview editor) follow along immediately. An open preview of the other kind picks the change up the next time it updates, for example when you edit the file.

**Why VS Code asks:** the preview can't change VS Code settings by itself. Each option in the menu is a `vscode://` link to this extension, and VS Code checks with you before an extension handles such a link. The extension only uses these links to update its own settings, to open the Settings editor (*Open all settings…*) and to refresh the preview (the refresh button). Allowing them once covers all of these.

If you click **Cancel**, the setting isn't saved. The preview keeps showing your choice for now, but goes back to the saved setting the next time it reloads. If you'd rather not allow the links at all, change the settings in VS Code's Settings instead.

Changing a setting in VS Code's Settings reloads open previews to apply it, and they then scroll to match where the editor is.

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

## How it works

The extension uses VS Code's Markdown preview extension points (`markdown.previewScripts`, `markdown.previewStyles` and `markdown.markdownItPlugins`).

- `src/preview/toc/` builds the sidebar from the rendered headings and rebuilds it whenever the preview content or a setting changes. Markdown headings already have `id`s; headings written as HTML get one from the sidebar. It also marks headings for the right-click menu (`data-vscode-context`), with the links ready to copy. `index.ts` starts it; `sidebar.ts` builds the list from the entries `outline.ts` works out, `active.ts` and `scroll.ts` keep the current section highlighted, and the other files each hold one part of the sidebar, like `collapse.ts`, `keyboard.ts`, `resizer.ts`, `scrollbar.ts`, `toggle.ts` and `settings-menu.ts`.
- `src/preview/smooth-scroll-sync.ts` takes over the preview's scroll-sync jumps and animates them instead.
- `src/preview/scroll-restore.ts` remembers where you are in the preview. VS Code rebuilds a preview from its last full render when its tab comes back from the background, and the preview then scrolls to the position saved in that render; this puts it back where you were. It also remembers where you were in each file, so a refresh doesn't move you either.
- `media/toc.css` styles the sidebar using your theme's colors.
- `src/extension.ts` connects the preview to VS Code settings, which the preview can't access itself. It reads the settings and their allowed values from `package.json`, adds a hidden element carrying the settings to each rendered preview, and refreshes open previews when a setting changes. The cog menu's options are `vscode://` links, which VS Code hands to this file's URI handler to update the setting. The refresh button is such a link too, and runs VS Code's *Markdown: Refresh Preview*. The commands behind the right-click menu's copy items are in this file too.
- `src/preview-refresher.ts` keeps previews in background tabs up to date. While a preview is on screen, edits and cog-menu choices only update the running page, and VS Code would bring a preview back from the background as it was last fully rendered. So when a preview goes to the background after such a change, this runs *Markdown: Refresh Preview*, which also renders the previews in the background anew.
- `src/shared/` holds the constants and helpers that both the extension and the preview scripts use. `src/types/` holds the types: `extension.ts` for the extension, `preview.ts` and `window.d.ts` for the preview scripts, and `shared.ts` for the data passed between the two, like the links the right-click menu copies.

## Development

1. Clone the repository, run `npm install` and open it in VS Code.
2. Press `F5` to open a test window with the extension loaded and `sample.md` open.
3. Open the preview with `Cmd+K V` / `Ctrl+K V`.

There are two launch configurations. **Run Extension (no other extensions)** disables your installed extensions in the test window, so the Debug Console only shows output from this extension and VS Code's built-ins.

The TypeScript in `src/` is built into `dist/` with esbuild. `F5` starts `npm run watch` first, which rebuilds on every change; build errors show up in the Problems panel. After a change, run **Developer: Reload Window** in the test window to load it. If a stylesheet change doesn't show up, stop and restart debugging: the preview can keep serving the old CSS.

| Command | What it does |
|---|---|
| `npm run build` | Builds `dist/` once. Packaging the extension runs it too. |
| `npm run watch` | Rebuilds `dist/` on every change. |
| `npm run typecheck` | Checks the types; esbuild only strips them. |
| `npm run lint` | Lints with Oxlint. |
| `npm run format` | Formats with Oxfmt; `npm run format:check` only checks. |
| `npm test` | Runs the tests. |

The tests run in Node straight from TypeScript and cover the parts of `src/preview/toc/` that don't need a browser, such as building, numbering and collapsing the list. Pull requests run all the checks.

### Releasing

Write what changed under `## Unreleased` in `CHANGELOG.md`, then run `npm run release -- minor` (or `patch`, `major` or an exact version) on an up-to-date `main`. It needs the GitHub CLI signed in as `mackans95`. The script:

1. Bumps `version` in `package.json` and `package-lock.json`, renames the *Unreleased* section to the new version, runs all the checks and commits *Release x.y.z* on `main`.
2. Tags the commit and, once you confirm, pushes `main` and the tag together. The release workflow then packages the extension and attaches the `.vsix` to a draft GitHub release.
3. Writes the release notes from the changelog and, once you confirm, publishes the release. That starts the publish workflow, which uploads the same `.vsix` to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mackans95.markdown-toc-sidebar) and [Open VSX](https://open-vsx.org/extension/mackans95/markdown-toc-sidebar) through Trusted Publishing, so no tokens are stored anywhere.
4. Follows the publish workflow, and offers to re-run it if it fails.

Every step skips itself once it's done, so if something fails, fix it and run `npm run release` again, without an argument, to carry on.

## License

[MIT](LICENSE)
