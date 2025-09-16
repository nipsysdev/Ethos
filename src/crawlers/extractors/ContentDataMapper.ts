import type { CrawledData, FieldExtractionStats } from "@/core/types.js";
import { parsePublishedDate } from "@/utils/date.js";
import type { ContentExtractionData } from "./ContentPageExtractor";

/**
 * Merges content data into the crawled item, overwriting listing data where content data exists
 */
export function mergeContentData(
	item: CrawledData,
	contentData: ContentExtractionData,
): void {
	if (contentData.title) item.title = contentData.title;
	if (contentData.content) item.content = contentData.content;
	if (contentData.author) item.author = contentData.author;

	if (contentData.publishedDate) {
		try {
			const parsedDate = parsePublishedDate(contentData.publishedDate);
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
	contentData: ContentExtractionData,
	contentFieldStats: FieldExtractionStats[],
	itemIndex: number,
): { contentFields: string[]; failedContentFields: string[] } {
	// Track what we got from content vs listing
	const contentFields = (
		Object.keys(contentData) as (keyof ContentExtractionData)[]
	).filter((key) => contentData[key] !== null);
	const failedContentFields = (
		Object.keys(contentData) as (keyof ContentExtractionData)[]
	).filter((key) => contentData[key] === null);

	// Update content field stats
	contentFieldStats.forEach((stat) => {
		stat.totalAttempts++;
		if (contentFields.includes(stat.fieldName as keyof ContentExtractionData)) {
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
