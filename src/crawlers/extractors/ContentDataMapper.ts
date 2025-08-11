import type { CrawledData, FieldExtractionStats } from "@/core/types.js";
import { parsePublishedDate } from "@/utils/date.js";

/**
 * Merges content data into the crawled item, overwriting listing data where content data exists
 */
export function mergeContentData(
	item: CrawledData,
	contentData: Record<string, string | null>,
): void {
	if (contentData.title) item.title = contentData.title;
	if (contentData.content) item.content = contentData.content;
	if (contentData.author) item.author = contentData.author;
	if (contentData.image) item.image = contentData.image;

	if (contentData.date) {
		try {
			const parsedDate = parsePublishedDate(contentData.date);
			item.publishedDate = parsedDate;
		} catch (error) {
			throw new Error(
				`Date parsing failed for content page "${item.url}": ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

/**
 * Updates field extraction statistics
 */
export function updateFieldStats(
	contentData: Record<string, string | null>,
	contentFieldStats: FieldExtractionStats[],
	itemIndex: number,
): { contentFields: string[]; failedContentFields: string[] } {
	// Track what we got from content vs listing
	const contentFields = Object.keys(contentData).filter(
		(key) => contentData[key] !== null,
	);
	const failedContentFields = Object.keys(contentData).filter(
		(key) => contentData[key] === null,
	);

	// Update content field stats
	contentFieldStats.forEach((stat) => {
		stat.totalAttempts++;
		if (contentFields.includes(stat.fieldName)) {
			stat.successCount++;
		} else {
			stat.missingItems.push(itemIndex + 1);
		}
	});

	return { contentFields, failedContentFields };
}

/**
 * Updates item metadata with extraction results
 */
export function updateItemMetadata(
	item: CrawledData,
	contentFields: string[],
	failedContentFields: string[],
	errors: string[],
): void {
	item.metadata = {
		...item.metadata,
		contentFieldsExtracted: contentFields,
		contentFieldsFailed: failedContentFields,
		contentExtractionErrors: errors,
	};
}
