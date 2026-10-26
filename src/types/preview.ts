/** The collapsed sections of each file, by heading id, with when they last changed. */
export type CollapsedStore = Record<string, { ids: string[]; time: number }>;

/** Which headings buildEntries lists, and how. */
export interface BuildOptions {
	/** The deepest heading level to list (1-6). */
	maxDepth?: number;
	/** 'title' marks a lone top heading with isTitle. */
	topHeading?: 'list' | 'title';
	/** Gives every entry but the title a number like '2.1'. */
	numbering?: boolean;
}

/** What buildEntries adds to each heading. */
export interface EntryFields {
	depth: number;
	isTitle?: boolean;
	number?: string;
}

/** One setting in the sidebar's settings menu, with the options it offers. */
export interface SettingGroup {
	/** The setting's name without the markdownTocSidebar. prefix, as in the config element's dataset. */
	key: string;
	label: string;
	/** [value, text] for each option, with the value as the config element has it. */
	options: [string, string][];
}

/** Where the view was: the block at its top and how far into it, with the plain offset as a fallback. */
export interface Position {
	line?: string;
	progress?: number;
	y: number;
}

/** A Position as scroll-restore stores it, with when it was saved. */
export interface SavedPosition extends Position {
	time: number;
}

/** A heading as the sidebar lists it. */
export type Entry = { id: string; text: string; level: number } & EntryFields;
