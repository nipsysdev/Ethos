/**
 * Shared constants for crawler extractors
 */

/**
 * Timeout configurations for content extraction
 */
export const EXTRACTION_TIMEOUTS = {
	/** Timeout for waiting for dynamic content to load (reduced for faster crawling) */
	DYNAMIC_CONTENT_MS: 6000, // 6 seconds (reduced from 10)
} as const;

/**
 * Default concurrency limits for content extraction
 */
export const EXTRACTION_CONCURRENCY = {
	/** Default number of concurrent content pages to process */
	DEFAULT_LIMIT: 5,
	/** Increased limit for faster processing when system can handle it */
	HIGH_PERFORMANCE_LIMIT: 8,
} as const;

// Legacy export for backward compatibility
export const DYNAMIC_CONTENT_TIMEOUT = EXTRACTION_TIMEOUTS.DYNAMIC_CONTENT_MS;
