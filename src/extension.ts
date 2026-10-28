// Runs in the extension host and connects the preview scripts to VS Code settings, which they
// can't access themselves:
// - Settings -> preview: a markdown-it plugin adds a hidden element with the current settings as
//   data attributes to every rendered preview; src/preview/toc/config.ts reads it from there.
// - Preview -> settings: the sidebar's settings menu is made of vscode:// links, which VS Code
//   routes to the URI handler registered below. The preview has already applied the choice
//   itself, so saving it doesn't need to refresh the previews. The sidebar's refresh button is
//   such a link too.
// Previews in background tabs are kept up to date by src/preview-refresher.ts.
import * as vscode from 'vscode'
import { PreviewRefresher } from './preview-refresher.ts'
import { CONFIG_ELEMENT_ID } from './shared/constants.ts'
import { escapeAttribute, toKebabCase } from './shared/helpers.ts'
import type { SettingValue, PackageJson, MarkdownIt, Setting, MarkdownItPlugin } from './types/extension.ts'
import type { HeadingContext, HeadingLinks } from './types/shared.ts'

// The markdown-it token type (and rule name) that renders the hidden config element.
const CONFIG_TOKEN_TYPE = 'md_toc_sidebar_config'

/**
 * The heading context menu in the preview. VS Code passes the right-clicked element's
 * data-vscode-context, where src/preview/toc/headings.ts has put the ready-made links.
 */
function copyHeadingLink(field: keyof HeadingLinks): (item?: Partial<HeadingContext>) => Promise<void> {
	return async item => {
		const text = item?.[field]
		if (typeof text !== 'string') return
		await vscode.env.clipboard.writeText(text)
		vscode.window.setStatusBarMessage(`Copied link to "${item?.headingText}"`, 3000)
	}
}

/** Registers a listener for configuration changes, and refreshes open previews when a setting changed. */
function registerConfigListener(
	settings: Settings,
	refresher: PreviewRefresher,
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (settings.changedOutsideMenu(e)) {
				refresher.refresh()
			}
		}),
	)
}

/** Registers a URI handler for the sidebar's settings menu, which is made of vscode:// links. */
function registerUriHandler(
	settings: Settings,
	refresher: PreviewRefresher,
	context: vscode.ExtensionContext,
	extensionId: string,
): void {
	context.subscriptions.push(
		vscode.window.registerUriHandler({
			/**
			 * Handles vscode://<extension id>/set?key=value, /open-settings and /refresh.
			 */
			async handleUri(uri: vscode.Uri): Promise<void> {
				if (uri.path === '/set') {
					const params = new URLSearchParams(uri.query)
					for (const [key, value] of params) {
						await settings.saveFromMenu(key, value)
					}
					await refresher.onMenuSave()
				} else if (uri.path === '/open-settings') {
					await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${extensionId}`)
				} else if (uri.path === '/refresh') {
					await refresher.refresh()
				}
			},
		}),
	)
}

/** Registers commands for the heading context menu in the preview. */
function registerCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(`${Settings.SECTION}.copyHeadingLink`, copyHeadingLink('link')),
		vscode.commands.registerCommand(`${Settings.SECTION}.copyHeadingMarkdownLink`, copyHeadingLink('markdownLink')),
	)
}

/**
 * The extension's settings, as package.json declares them.
 * Only reads and writes values that package.json allows.
 */
class Settings {
	// The settings prefix in package.json, e.g. "markdownTocSidebar.position".
	static readonly SECTION = 'markdownTocSidebar'

	// Allowed values and the default for each setting, by short key, e.g. "position".
	private readonly allowed: Record<string, Setting> = {}
	// Settings currently being saved from the sidebar's menu. Open previews already show those values, so the change doesn't need the (slow, full-reload) preview refresh.
	private readonly savingFromMenu = new Set<string>()

	/** package.json is the only source for the settings, so we read them from there and map them to a format we can use. */
	constructor(packageJson: PackageJson) {
		const properties = packageJson.contributes.configuration.properties

		for (const [fullKey, property] of Object.entries(properties)) {
			const shortKey = fullKey.slice(Settings.SECTION.length + 1)
			const values = property.type === 'boolean' ? [false, true] : (property.enum ?? [])

			this.allowed[shortKey] = { values, default: property.default }
		}
	}

	/** The short keys of all settings, e.g. "position". */
	get keys(): string[] {
		return Object.keys(this.allowed)
	}

	/** Reads the current value of a setting from VS Code, falling back to the default if it's not set or invalid. */
	read(key: string): SettingValue {
		const value = vscode.workspace.getConfiguration(Settings.SECTION).get(key)
		return this.allowed[key].values.find(v => v === value) ?? this.allowed[key].default
	}

	/**
	 * Saves a value chosen in the sidebar's settings menu, given as text from its vscode:// link.
	 * Unknown keys and values that aren't allowed are ignored.
	 */
	async saveFromMenu(key: string, text: string): Promise<void> {
		const allowed = this.allowed[key]?.values.find(v => String(v) === text)
		if (allowed !== undefined) {
			this.savingFromMenu.add(key)
			try {
				await this.write(key, allowed)
			} finally {
				// The change event may arrive just after the write resolves.
				setTimeout(() => this.savingFromMenu.delete(key), 1000)
			}
		}
	}

	/** Whether the event changed any of our settings other than through the menu, e.g. in the Settings editor. */
	changedOutsideMenu(e: vscode.ConfigurationChangeEvent): boolean {
		const changed = this.keys.filter(key => e.affectsConfiguration(`${Settings.SECTION}.${key}`))
		// False when none of our settings changed: every() is true for an empty list.
		return !changed.every(key => this.savingFromMenu.has(key))
	}

	/**
	 * Writes the value where the setting currently comes from,
	 * so a workspace setting isn't silently shadowed by a user setting that has no effect.
	 */
	private write(key: string, value: SettingValue): Thenable<void> {
		const config = vscode.workspace.getConfiguration(Settings.SECTION)
		const inspected = config.inspect(key)

		// The `workspaceFolderValue` comes from a folder's `.vscode/settings.json` in a multi-root workspace.
		const isSettingInWorkspaceFolder = inspected?.workspaceFolderValue !== undefined
		// The `workspaceValue` comes from `.vscode/settings.json` in a single-root workspace, or from the `.code-workspace` file in a multi-root workspace.
		const isSettingInWorkspace = inspected?.workspaceValue !== undefined

		const target = isSettingInWorkspaceFolder
			? vscode.ConfigurationTarget.WorkspaceFolder
			: isSettingInWorkspace
				? vscode.ConfigurationTarget.Workspace
				: vscode.ConfigurationTarget.Global

		return config.update(key, value, target)
	}
}

/** Activates the extension. */
export function activate(context: vscode.ExtensionContext): MarkdownItPlugin {
	const settings = new Settings(context.extension.packageJSON)
	const refresher = new PreviewRefresher()
	const extensionId = context.extension.id
	const uriBase = `${vscode.env.uriScheme}://${extensionId}`

	refresher.register(context)
	registerConfigListener(settings, refresher, context)
	registerUriHandler(settings, refresher, context, extensionId)
	registerCommands(context)

	return {
		/**
		 * Called by the built-in Markdown extension (package.json's "markdown.markdownItPlugins"):
		 * adds the hidden config element to every rendered preview.
		 */
		extendMarkdownIt(md: MarkdownIt): MarkdownIt {
			md.core.ruler.push(CONFIG_TOKEN_TYPE, state => {
				// Inline-only renders (e.g. a single line) have no document to attach the element to.
				if (!state.inlineMode) {
					const token = new state.Token(CONFIG_TOKEN_TYPE, '', 0)
					token.block = true
					state.tokens.unshift(token)
				}
			})
			// The values are filled in when rendering rather than when parsing: the markdown extension
			// caches parsed tokens, so values baked in at parse time could be stale.
			md.renderer.rules[CONFIG_TOKEN_TYPE] = (_tokens, _index, _options, env) => {
				const attributes = settings.keys.map(
					key => `data-${toKebabCase(key)}="${escapeAttribute(settings.read(key))}"`,
				)
				attributes.push(`data-uri-base="${escapeAttribute(uriBase)}"`)
				// For src/preview/scroll-restore.ts: which file this is, and whether a refresh rendered it.
				if (env?.currentDocument) {
					attributes.push(`data-document="${escapeAttribute(env.currentDocument.toString())}"`)
				}
				if (refresher.isRefreshing()) {
					attributes.push('data-from-refresh="true"')
				}
				return `<div id="${CONFIG_ELEMENT_ID}" ${attributes.join(' ')} hidden></div>\n`
			}
			return md
		},
	}
}
