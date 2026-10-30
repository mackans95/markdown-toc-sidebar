/** The collapsed sections of each file, by heading id, with when they last changed. */
export type CollapsedStore = Record<string, { ids: string[]; time: number }>

/** Which headings buildEntries lists, and how. */
export interface BuildOptions {
	/** The deepest heading level to list (1-6). */
	maxDepth?: number
	/** 'title' marks a lone top heading with isTitle. */
	topHeading?: 'list' | 'title'
	/** Gives every entry but the title a number like '2.1'. */
	numbering?: boolean
}

/** What buildEntries adds to each heading. */
export interface EntryFields {
	depth: number
	isTitle?: boolean
	number?: string
}

/** One setting in the sidebar's settings menu, with the options it offers. */
export interface SettingGroup {
	/** The setting's name without the markdownTocSidebar. prefix, as in the config element's dataset. */
	key: keyof PreviewConfig
	label: string
	/** [value, text] for each option, with the value as the config element has it. */
	options: [string, string][]
	/** A setting this one only works with: the group is hidden while that one is off. */
	requires?: keyof PreviewConfig
}

/** Where the view was: the block at its top and how far into it, with the plain offset as a fallback. */
export interface Position {
	line?: string
	progress?: number
	y: number
}

/** A Position as scroll-restore stores it, with when it was saved. */
export interface SavedPosition extends Position {
	time: number
}

/** A heading as the sidebar lists it. */
export type Entry = { id: string; text: string; level: number } & EntryFields

/** The settings in the config element's dataset, by short key, with the values src/extension.ts can write for each. */
export interface PreviewConfig {
	scrollBehavior: 'smooth' | 'instant'
	position: 'right' | 'left'
	maxDepth: '1' | '2' | '3' | '4' | '5' | '6'
	topHeading: 'list' | 'title'
	numbering: 'true' | 'false'
	collapsible: 'true' | 'false'
	autoCollapse: 'true' | 'false'
	scrollbar: 'visible' | 'hover' | 'hidden'
	indentGuides: 'auto' | 'onHover' | 'always' | 'none'
	/** VS Code's workbench.tree.renderIndentGuides, which indentGuides 'auto' follows; not a setting of ours. */
	treeIndentGuides: 'onHover' | 'always' | 'none'
}

/** The edges of a box on screen, in viewport pixels; a DOMRect has them too. */
export interface Box {
	left: number
	right: number
	top: number
	bottom: number
}

/** What tooltipPosition needs to place a tooltip. */
export interface TooltipPositionParams {
	/** The element the tooltip belongs to, or the pointer as a zero-size box. */
	anchor: Box
	size: { width: number; height: number }
	viewport: { width: number; height: number }
	/** Which side of the anchor it goes on; flipped when there's no room there. */
	placement: 'above' | 'below'
	/** 'start' lines up the left edges, 'end' the right edges. */
	align: 'start' | 'end'
}
