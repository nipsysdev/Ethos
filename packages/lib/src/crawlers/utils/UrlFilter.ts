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
 * Filter URLs based on exclusion patterns
 */
export function filterByExclusion(
	items: CrawledData[],
	config: UrlFilterConfig,
	currentOffset: number,
): UrlFilterResult {
	if (!config.excludePatterns || config.excludePatterns.length === 0) {
		return {
			filteredItems: [...items],
			excludedCount: 0,
			excludedItemIndices: [],
		};
	}

	const filteredItems: CrawledData[] = [];
	const excludedItemIndices: number[] = [];
	let excludedCount = 0;

	items.forEach((item, index) => {
		const absoluteUrl = new URL(item.url, config.baseUrl).href;
		const isExcluded = (config.excludePatterns ?? []).some((pattern) =>
			absoluteUrl.includes(pattern),
		);

		if (isExcluded) {
			excludedCount++;
			// Track the absolute index (offset + current page item index + 1)
			excludedItemIndices.push(currentOffset + index + 1);
		} else {
			filteredItems.push(item);
		}
	});

	return {
		filteredItems,
		excludedCount,
		excludedItemIndices,
	};
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
