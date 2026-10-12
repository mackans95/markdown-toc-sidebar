// Runs in the extension host. The preview scripts can't read VS Code settings themselves, so this
// passes them along: a markdown-it plugin adds a hidden element with the settings as data
// attributes to every rendered preview, and media/toc.js reads it from there.
const vscode = require('vscode');

const SECTION = 'markdownTocSidebar';
const CONFIG_ELEMENT_ID = 'md-toc-sidebar-config';

function readScrollBehavior() {
	const value = vscode.workspace.getConfiguration(SECTION).get('scrollBehavior');
	return value === 'instant' ? 'instant' : 'smooth';
}

function activate(context) {
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration(SECTION)) {
			// Clears the markdown extension's render cache and re-renders open previews,
			// so they pick up the new value without being reopened.
			vscode.commands.executeCommand('markdown.preview.refresh');
		}
	}));

	return {
		extendMarkdownIt(md) {
			md.core.ruler.push('md_toc_sidebar_config', state => {
				// Inline-only renders (e.g. a single line) have no document to attach the element to.
				if (state.inlineMode) {
					return;
				}
				const token = new state.Token('html_block', '', 0);
				token.content = `<div id="${CONFIG_ELEMENT_ID}" data-scroll-behavior="${readScrollBehavior()}" hidden></div>\n`;
				state.tokens.unshift(token);
			});
			return md;
		},
	};
}

function deactivate() { }

module.exports = { activate, deactivate };
