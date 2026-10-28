/**
 * A value a setting can have: an enum string, a number or a boolean.
 */
export type SettingValue = string | number | boolean

/**
 * The allowed values and the default of one setting, as package.json declares them.
 */
export interface Setting {
	values: SettingValue[]
	default: SettingValue
}

/**
 * The parts of package.json that the constructor of the Settings class reads.
 */
export interface PackageJson {
	contributes: {
		configuration: {
			properties: Record<string, { type: string; enum?: SettingValue[]; default: SettingValue }>
		}
	}
}

/**
 * The parts of markdown-it used here; the built-in Markdown extension passes in its own instance.
 */
export interface MarkdownIt {
	core: { ruler: { push(name: string, rule: (state: StateCore) => void): void } }
	renderer: { rules: Record<string, () => string> }
}

/**
 * The parts of markdown-it's parser state that a core rule gets.
 */
export interface StateCore {
	inlineMode: boolean
	tokens: Token[]
	Token: new (type: string, tag: string, nesting: number) => Token
}

/**
 * The parts of a markdown-it token used here.
 */
export interface Token {
	block: boolean
}

/**
 * The data-vscode-context of a right-clicked heading, as src/preview/toc/headings.ts wrote it.
 */
export interface HeadingContext {
	headingText: string
	link: string
	markdownLink: string
}

/**
 * What activate() returns: the built-in Markdown extension calls extendMarkdownIt for every preview it renders.
 */
export interface MarkdownItPlugin {
	extendMarkdownIt(md: MarkdownIt): MarkdownIt
}
