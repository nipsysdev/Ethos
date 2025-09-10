import type { CrawledData } from "@/core/types.js";

/**
 * Configuration for URL filtering operations
 */
export interface UrlFilterConfig {
	excludePatterns?: string[];
	baseUrl: string;
}

/**
 * Result of URL filtering operations
 */
export interface UrlFilterResult {
	filteredItems: CrawledData[];
	excludedCount: number;
	excludedItemIndices: number[];
}

/**
 * Filter out duplicate URLs from a set of items
 */
export function filterDuplicates(
	items: CrawledData[],
	seenUrls: Set<string>,
): CrawledData[] {
	const newItems: CrawledData[] = [];

	for (const item of items) {
		if (!seenUrls.has(item.url)) {
			seenUrls.add(item.url);
			newItems.push(item);
		}
	}

	return newItems;
}
