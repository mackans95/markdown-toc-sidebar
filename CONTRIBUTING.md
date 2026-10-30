# Contributing

Issues and pull requests are welcome.

## How it works

The extension uses VS Code's Markdown preview extension points (`markdown.previewScripts`, `markdown.previewStyles` and `markdown.markdownItPlugins`).

- `src/preview/toc/` builds the sidebar from the rendered headings and rebuilds it whenever the preview content or a setting changes. Markdown headings already have `id`s; headings written as HTML get one from the sidebar. It also marks headings for the right-click menu (`data-vscode-context`), with the links ready to copy. `index.ts` starts it; `sidebar.ts` builds the list from the entries `outline.ts` works out, `active.ts` and `scroll.ts` keep the current section highlighted, and the other files each hold one part of the sidebar, like `collapse.ts`, `keyboard.ts`, `resizer.ts`, `scrollbar.ts`, `toggle.ts` and `settings-menu.ts`.
- `src/preview/smooth-scroll-sync.ts` takes over the preview's scroll-sync jumps and animates them instead.
- `src/preview/scroll-restore.ts` remembers where you are in the preview. VS Code rebuilds a preview from its last full render when its tab comes back from the background, and the preview then scrolls to the position saved in that render; this puts it back where you were. It also remembers where you were in each file, so a refresh doesn't move you either.
- `src/preview/toc/styles/` styles the sidebar using your theme's colors, one file per part, like `header-buttons.css`, `list.css` and `settings-menu.css`. `index.css` imports them all, and the build bundles them into one stylesheet for the preview.
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

## Releasing

Write what changed under `## Unreleased` in `CHANGELOG.md`, then run `npm run release -- minor` (or `patch`, `major` or an exact version) on an up-to-date `main`. It needs the GitHub CLI signed in as `mackans95`. The script:

1. Bumps `version` in `package.json` and `package-lock.json`, renames the *Unreleased* section to the new version, runs all the checks and commits *Release x.y.z* on `main`.
2. Tags the commit and, once you confirm, pushes `main` and the tag together. The release workflow then packages the extension and attaches the `.vsix` to a draft GitHub release.
3. Writes the release notes from the changelog and, once you confirm, publishes the release. That starts the publish workflow, which uploads the same `.vsix` to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mackans95.markdown-toc-sidebar) and [Open VSX](https://open-vsx.org/extension/mackans95/markdown-toc-sidebar) through Trusted Publishing, so no tokens are stored anywhere.
4. Follows the publish workflow, and offers to re-run it if it fails.

Every step skips itself once it's done, so if something fails, fix it and run `npm run release` again, without an argument, to carry on.
