/**
 * URL utility functions for crawlers and other components
 */

/**
 * Resolves a URL to an absolute URL using the provided base URL
 * @param url - The URL to resolve (can be relative or absolute)
 * @param baseUrl - The base URL to resolve against
 * @returns The absolute URL
 */
export function resolveAbsoluteUrl(url: string, baseUrl: string): string {
	return url.startsWith("http") ? url : new URL(url, baseUrl).href;
}
