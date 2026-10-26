import type { SettingValue } from '../types/extension.ts';

/**
 * Escapes a value for use inside a double-quoted HTML attribute.
 */
export function escapeAttribute(value: SettingValue): string {
	return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Turns a camelCase key into kebab-case, e.g. "maxDepth" into "max-depth".
 * Attribute names are kebab-case; the preview reads them back as camelCase through dataset.
 */
export function toKebabCase(key: string): string {
	return key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
}
