/**
 * Shared constants for crawler extractors
 */

/**
 * Timeout for waiting for dynamic content to load (in milliseconds)
 * Reduced for faster crawling while still accommodating slower-loading sites
 */
export const DYNAMIC_CONTENT_TIMEOUT = 6000; // 6 seconds (reduced from 10)
