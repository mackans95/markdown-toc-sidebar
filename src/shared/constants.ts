// Values that more than one file has to agree on. Each file is bundled on its own, so this ends up
// copied into each of them rather than shared at runtime.

// The hidden element src/extension.ts renders into every preview, with the settings as data attributes.
export const CONFIG_ELEMENT_ID = 'md-toc-sidebar-config'

// Fired by smooth-scroll-sync for the positions it hides from regular scroll listeners.
export const SYNCED_SCROLL_EVENT = 'md-toc-sidebar:synced-scroll'

// The user starting to scroll themselves, which stops any scrolling we're doing for them.
export const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown']
