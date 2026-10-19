// Runs in the extension host and connects the preview scripts to VS Code settings, which they
// can't access themselves:
// - Settings -> preview: a markdown-it plugin adds a hidden element with the current settings as
//   data attributes to every rendered preview; src/preview/toc/index.js reads it from there.
// - Preview -> settings: the sidebar's settings menu is made of vscode:// links, which VS Code
//   routes to the URI handler registered below. The preview has already applied the choice
//   itself, so saving it doesn't need to refresh the previews. The sidebar's refresh button is
//   such a link too.
import * as vscode from 'vscode';
import { CONFIG_ELEMENT_ID } from './shared/constants.ts';

const SECTION = 'markdownTocSidebar';
const CONFIG_TOKEN_TYPE = 'md_toc_sidebar_config';

type SettingValue = string | number | boolean;

interface Setting {
	values: SettingValue[];
	default: SettingValue;
}

// The parts of package.json that readSettingsSchema() reads.
interface PackageJson {
	contributes: {
		configuration: {
			properties: Record<string, { type: string; enum?: SettingValue[]; default: SettingValue }>;
		};
	};
}

// The parts of markdown-it used here; the built-in Markdown extension passes in its own instance.
interface MarkdownIt {
	core: { ruler: { push(name: string, rule: (state: StateCore) => void): void } };
	renderer: { rules: Record<string, () => string> };
}

interface StateCore {
	inlineMode: boolean;
	tokens: Token[];
	Token: new (type: string, tag: string, nesting: number) => Token;
}

interface Token {
	block: boolean;
}

// The data-vscode-context of a right-clicked heading, as src/preview/toc/index.js wrote it.
interface HeadingContext {
	headingText: string;
	link: string;
	markdownLink: string;
}

// Allowed values for each setting; filled out by readSettingsSchema() from package.json.
let SETTINGS: Record<string, Setting> = {};

function readSetting(key: string): SettingValue {
	const value = vscode.workspace.getConfiguration(SECTION).get(key);
	return SETTINGS[key].values.find(v => v === value) ?? SETTINGS[key].default;
}

// package.json is the only source for the settings,
// so we read them from there and map them to a format we can use.
function readSettingsSchema(packageJson: PackageJson): Record<string, Setting> {
	const properties = packageJson.contributes.configuration.properties;
	const settings: Record<string, Setting> = {};
	for (const [fullKey, property] of Object.entries(properties)) {
		const shortKey = fullKey.slice(SECTION.length + 1);
		const values = property.type === 'boolean' ? [false, true] : (property.enum ?? []);
		settings[shortKey] = { values, default: property.default };
	}
	return settings;
}

// Writes where the value currently comes from, so a workspace setting isn't silently shadowed
// by a user setting that has no effect.
function writeSetting(key: string, value: SettingValue): Thenable<void> {
	const config = vscode.workspace.getConfiguration(SECTION);
	const inspected = config.inspect(key);
	const target =
		inspected?.workspaceFolderValue !== undefined
			? vscode.ConfigurationTarget.WorkspaceFolder
			: inspected?.workspaceValue !== undefined
				? vscode.ConfigurationTarget.Workspace
				: vscode.ConfigurationTarget.Global;
	return config.update(key, value, target);
}

function escapeAttribute(value: SettingValue): string {
	return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Attribute names are kebab-case; the preview reads them back as camelCase through dataset.
function toKebabCase(key: string): string {
	return key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
}

export function activate(context: vscode.ExtensionContext) {
	SETTINGS = readSettingsSchema(context.extension.packageJSON);
	const extensionId = context.extension.id;
	const uriBase = `${vscode.env.uriScheme}://${extensionId}`;

	// Settings currently being saved from the sidebar's menu. Open previews already show those
	// values, so the change doesn't need the (slow, full-reload) preview refresh.
	const savingFromMenu = new Set<string>();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			const changed = Object.keys(SETTINGS).filter(key => event.affectsConfiguration(`${SECTION}.${key}`));
			// Also true when none of our settings changed: every() is true for an empty list.
			if (changed.every(key => savingFromMenu.has(key))) {
				return;
			}
			// Changed elsewhere, e.g. in the Settings editor: re-render open previews so they pick it up.
			vscode.commands.executeCommand('markdown.preview.refresh');
		}),
	);

	context.subscriptions.push(
		vscode.window.registerUriHandler({
			async handleUri(uri: vscode.Uri) {
				if (uri.path === '/set') {
					const params = new URLSearchParams(uri.query);
					for (const [key, value] of params) {
						const allowed = SETTINGS[key]?.values.find(v => String(v) === value);
						if (allowed !== undefined) {
							savingFromMenu.add(key);
							try {
								await writeSetting(key, allowed);
							} finally {
								// The change event may arrive just after the write resolves.
								setTimeout(() => savingFromMenu.delete(key), 1000);
							}
						}
					}
				} else if (uri.path === '/open-settings') {
					await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${extensionId}`);
				} else if (uri.path === '/refresh') {
					await vscode.commands.executeCommand('markdown.preview.refresh');
				}
			},
		}),
	);

	// The heading context menu in the preview. VS Code passes the right-clicked element's
	// data-vscode-context, where src/preview/toc/index.js has put the ready-made links.
	const copyHeadingLink = (field: 'link' | 'markdownLink') => async (item?: Partial<HeadingContext>) => {
		const text = item?.[field];
		if (typeof text !== 'string') {
			return;
		}
		await vscode.env.clipboard.writeText(text);
		vscode.window.setStatusBarMessage(`Copied link to "${item?.headingText}"`, 3000);
	};
	context.subscriptions.push(
		vscode.commands.registerCommand(`${SECTION}.copyHeadingLink`, copyHeadingLink('link')),
		vscode.commands.registerCommand(`${SECTION}.copyHeadingMarkdownLink`, copyHeadingLink('markdownLink')),
	);

	return {
		extendMarkdownIt(md: MarkdownIt) {
			md.core.ruler.push(CONFIG_TOKEN_TYPE, state => {
				// Inline-only renders (e.g. a single line) have no document to attach the element to.
				if (!state.inlineMode) {
					const token = new state.Token(CONFIG_TOKEN_TYPE, '', 0);
					token.block = true;
					state.tokens.unshift(token);
				}
			});
			// The values are filled in when rendering rather than when parsing: the markdown extension
			// caches parsed tokens, so values baked in at parse time could be stale.
			md.renderer.rules[CONFIG_TOKEN_TYPE] = () => {
				const attributes = Object.keys(SETTINGS).map(
					key => `data-${toKebabCase(key)}="${escapeAttribute(readSetting(key))}"`,
				);
				attributes.push(`data-uri-base="${escapeAttribute(uriBase)}"`);
				return `<div id="${CONFIG_ELEMENT_ID}" ${attributes.join(' ')} hidden></div>\n`;
			};
			return md;
		},
	};
}

export function deactivate() {}
