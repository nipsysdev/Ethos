import type { CrawlMetadata, CrawlSummary } from "@/core/types.js";

/**
 * Creates a consistent CrawlSummary from metadata and session data
 * Used to ensure both fresh crawls and session reconstruction produce identical summaries
 */
export function buildCrawlSummary(
	sessionData: {
		sourceId: string;
		sourceName: string;
		startTime: Date;
		endTime?: Date | null;
		sessionId: string;
	},
	metadata: CrawlMetadata,
	overrides?: {
		itemsWithErrors?: number;
		storageStats?: {
			itemsStored: number;
			itemsFailed: number;
			totalItems: number;
		};
	},
): CrawlSummary {
	const endTime = sessionData.endTime || new Date();

	return {
		sourceId: sessionData.sourceId,
		sourceName: sessionData.sourceName,
		itemsFound:
			metadata.itemsProcessed +
			metadata.duplicatesSkipped +
			metadata.totalFilteredItems,
		itemsProcessed: metadata.itemsProcessed,
		itemsWithErrors:
			overrides?.itemsWithErrors ??
			metadata.listingErrors.length + metadata.contentErrors.length,
		fieldStats: metadata.fieldStats,
		contentFieldStats: metadata.contentFieldStats,
		listingErrors: metadata.listingErrors,
		startTime: sessionData.startTime,
		endTime,
		pagesProcessed: metadata.pagesProcessed,
		duplicatesSkipped: metadata.duplicatesSkipped,
		urlsExcluded: metadata.urlsExcluded,
		stoppedReason: metadata.stoppedReason,
		contentsCrawled: metadata.contentsCrawled,
		contentErrors: metadata.contentErrors,
		sessionId: sessionData.sessionId,
		storageStats: overrides?.storageStats,
	};
}
