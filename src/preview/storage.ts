// localStorage for the preview scripts. It can be unavailable (or full): reads then return the
// fallback and writes do nothing, so whatever was stored just isn't remembered.

export function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

// The parsed value, or the fallback when there is none or it isn't valid JSON.
export function readStoredJson<T>(key: string, fallback: T): T {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null') || fallback;
	} catch {
		return fallback;
	}
}

// Stores the value, or removes the key for undefined.
export function writeStored(key: string, value: string | undefined): void {
	try {
		if (value === undefined) {
			localStorage.removeItem(key);
		} else {
			localStorage.setItem(key, value);
		}
	} catch {
		// Storage unavailable; see above.
	}
}
