// Keeps previews in background tabs up to date. VS Code doesn't keep a preview running while its tab is
// in the background: when the tab is shown again, it rebuilds the page from the HTML of the preview's last
// full render. While a preview is on screen, edits and choices from the sidebar's settings menu only update
// the running page, so a preview that goes to the background after one would come back without it.
// Refreshing the previews right then gives the hidden one a new full render to come back to.
import * as vscode from 'vscode'

// The view types of the side preview (a webview panel) and of the Markdown Preview editor (a custom editor).
const SIDE_PREVIEW_VIEW_TYPE = 'mainThreadWebview-markdown.preview'
const PREVIEW_EDITOR_VIEW_TYPE = 'vscode.markdown.preview.editor'
// The preview waits 300ms before rendering after a refresh; renders this soon after one are counted as part of it.
const REFRESH_RENDER_WINDOW_MS = 2000

/** Which kind of preview a tab shows, or undefined when it isn't a Markdown preview. */
function previewKind(tab: vscode.Tab | undefined): 'side' | 'editor' | undefined {
	const input = tab?.input
	if (input instanceof vscode.TabInputWebview && input.viewType === SIDE_PREVIEW_VIEW_TYPE) {
		return 'side'
	}
	if (input instanceof vscode.TabInputCustom && input.viewType === PREVIEW_EDITOR_VIEW_TYPE) {
		return 'editor'
	}
	return undefined
}

/** The previews on screen: the tabs that are active in their group and show a preview. */
function shownPreviews(): Set<vscode.Tab> {
	const shown = new Set<vscode.Tab>()

	for (const group of vscode.window.tabGroups.all) {
		if (group.activeTab && previewKind(group.activeTab)) {
			shown.add(group.activeTab)
		}
	}

	return shown
}

/** Refreshes the previews when one goes to the background out of date, and remembers when it last refreshed them. */
export class PreviewRefresher {
	// Whether a preview may have changed since its last full render; the next one to go to the background then refreshes them.
	private stale = false
	private shown = shownPreviews()
	private lastRefresh = 0

	/** Listens for edits and for previews going to the background. */
	register(context: vscode.ExtensionContext): void {
		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e)),
			vscode.window.tabGroups.onDidChangeTabs(() => this.onTabsChange()),
			vscode.window.tabGroups.onDidChangeTabGroups(() => this.onTabsChange()),
		)
	}

	/** Whether a render happening now is part of a refresh, so the preview can keep its scroll position. */
	isRefreshing(): boolean {
		return Date.now() - this.lastRefresh < REFRESH_RENDER_WINDOW_MS
	}

	/** Refreshes every open preview: each gets a new full render, also the ones in the background. */
	async refresh(): Promise<void> {
		this.stale = false
		this.lastRefresh = Date.now()
		await vscode.commands.executeCommand('markdown.preview.refresh')
	}

	/**
	 * After a setting is saved from the sidebar's menu. Previews of the same kind share it right away
	 * through their storage, but the other kind doesn't, so with both on screen they're refreshed now.
	 */
	async onMenuSave(): Promise<void> {
		this.stale = true
		const kinds = new Set([...this.shown].map(tab => previewKind(tab)))
		if (kinds.size > 1) {
			await this.refresh()
		}
	}

	/** An edit while a preview is on screen only updates the running page, so the previews go stale. */
	private onDocumentChange(e: vscode.TextDocumentChangeEvent): void {
		if (e.document.languageId === 'markdown' && e.contentChanges.length > 0 && this.shown.size > 0) {
			this.stale = true
		}
	}

	/** Refreshes the previews when one went to the background while they were stale. */
	private onTabsChange(): void {
		const shown = shownPreviews()
		// VS Code keeps the same Tab object while the tab stays open, also when its label changes.
		const wentHidden = [...this.shown].some(tab => !shown.has(tab))
		this.shown = shown

		if (wentHidden && this.stale) {
			this.refresh()
		}
	}
}
