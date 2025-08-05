import type { CrawledData, FieldExtractionStats } from "@/core/types.js";
import { parsePublishedDate } from "@/utils/date.js";

/**
 * Merges detail data into the crawled item, overwriting listing data where detail data exists
 */
export function mergeDetailData(
	item: CrawledData,
	detailData: Record<string, string | null>,
): void {
	if (detailData.title) item.title = detailData.title;
	if (detailData.content) item.content = detailData.content;
	if (detailData.author) item.author = detailData.author;
	if (detailData.image) item.image = detailData.image;

	if (detailData.date) {
		try {
			const parsedDate = parsePublishedDate(detailData.date);
			item.publishedDate = parsedDate;
		} catch (error) {
			throw new Error(
				`Date parsing failed for detail page "${item.url}": ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

/**
 * Updates field extraction statistics
 */
export function updateFieldStats(
	detailData: Record<string, string | null>,
	detailFieldStats: FieldExtractionStats[],
	itemIndex: number,
): { detailFields: string[]; failedDetailFields: string[] } {
	// Track what we got from detail vs listing
	const detailFields = Object.keys(detailData).filter(
		(key) => detailData[key] !== null,
	);
	const failedDetailFields = Object.keys(detailData).filter(
		(key) => detailData[key] === null,
	);

	// Update detail field stats
	detailFieldStats.forEach((stat) => {
		stat.totalAttempts++;
		if (detailFields.includes(stat.fieldName)) {
			stat.successCount++;
		} else {
			stat.missingItems.push(itemIndex + 1);
		}
	});

	return { detailFields, failedDetailFields };
}

/**
 * Updates item metadata with extraction results
 */
export function updateItemMetadata(
	item: CrawledData,
	detailFields: string[],
	failedDetailFields: string[],
	errors: string[],
): void {
	item.metadata = {
		...item.metadata,
		detailFieldsExtracted: detailFields,
		detailFieldsFailed: failedDetailFields,
		detailExtractionErrors: errors,
	};
}
