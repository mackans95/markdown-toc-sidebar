// Flags the preview scripts set on window when they start, so loading a script twice doesn't
// start it twice.
interface Window {
	/** Set once toc/index.ts has started. */
	__mdTocSidebarInitialized?: boolean
	/** Set once smooth-scroll-sync.ts has started. */
	__mdTocSmoothSyncInitialized?: boolean
	/** Set once scroll-restore.ts has started. */
	__mdTocScrollRestoreInitialized?: boolean
}
