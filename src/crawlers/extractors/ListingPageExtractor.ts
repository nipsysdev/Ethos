import type { Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { DYNAMIC_CONTENT_TIMEOUT } from "@/crawlers/extractors/constants";
import { parsePublishedDate } from "@/utils/date.js";

export interface ListingExtractionResult {
	items: CrawledData[];
	filteredCount: number;
	filteredReasons: string[];
}

interface ExtractionResult {
	item: Record<string, string | null>;
	fieldResults: Record<string, { success: boolean; value: string | null }>;
	hasRequiredFields: boolean;
	missingRequiredFields: string[];
}

export interface ListingPageExtractor {
	extractItemsFromPage: (
		page: Page,
		config: SourceConfig,
		fieldStats: FieldExtractionStats[],
		currentItemOffset: number,
	) => Promise<ListingExtractionResult>;
}

function resolveUrlAttribute(
	urlValue: string | null,
	baseUrl: string,
): string | null {
	if (!urlValue) return null;

	try {
		return new URL(urlValue, baseUrl).href;
	} catch {
		return urlValue;
	}
}

function extractTextWithExclusions(
	element: Element,
	excludeSelectors?: string[],
): string | null {
	if (excludeSelectors && excludeSelectors.length > 0) {
		const cloned = element.cloneNode(true) as Element;
		for (const selector of excludeSelectors) {
			const excludedElements = cloned.querySelectorAll(selector);
			for (const excludedElement of excludedElements) {
				excludedElement.remove();
			}
		}
		return cloned.textContent?.trim().replace(/\s+/g, " ") || null;
	} else {
		return element.textContent?.trim().replace(/\s+/g, " ") || null;
	}
}

function extractFieldValue(
	element: Element | null,
	fieldConfig: {
		selector: string;
		attribute: string;
		exclude_selectors?: string[];
		optional?: boolean;
	},
): string | null {
	if (!element) return null;

	if (fieldConfig.attribute === "text") {
		return extractTextWithExclusions(element, fieldConfig.exclude_selectors);
	} else if (
		fieldConfig.attribute === "href" ||
		fieldConfig.attribute === "src"
	) {
		const urlValue = element.getAttribute(fieldConfig.attribute);
		return resolveUrlAttribute(urlValue, window.location.href);
	} else {
		return element.getAttribute(fieldConfig.attribute);
	}
}

async function extractItemsFromPage(
	page: Page,
	config: SourceConfig,
	fieldStats: FieldExtractionStats[],
	currentItemOffset: number,
): Promise<ListingExtractionResult> {
	try {
		await page.waitForSelector(config.listing.items.container_selector, {
			timeout: DYNAMIC_CONTENT_TIMEOUT,
		});
	} catch {
		console.warn(
			`Warning: Container selector "${config.listing.items.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds`,
		);
	}

	const extractionResult = await page.evaluate((itemsConfig) => {
		const containers = document.querySelectorAll(
			itemsConfig.container_selector,
		);
		const results: ExtractionResult[] = [];

		containers.forEach((container) => {
			const item: Record<string, string | null> = {};
			const fieldResults: Record<
				string,
				{ success: boolean; value: string | null }
			> = {};
			let hasRequiredFields = true;
			const missingRequiredFields: string[] = [];

			for (const [fieldName, fieldConfig] of Object.entries(
				itemsConfig.fields,
			)) {
				let success = false;
				let value: string | null = null;

				const typedFieldConfig = fieldConfig as {
					selector: string;
					attribute: string;
					exclude_selectors?: string[];
					optional?: boolean;
				};

				try {
					const element = container.querySelector(typedFieldConfig.selector);
					value = extractFieldValue(element, typedFieldConfig);
					success = value !== null && value !== "";
				} catch {
					// Field extraction failed
				}

				fieldResults[fieldName] = { success, value };

				if (success) {
					item[fieldName] = value;
				} else if (!typedFieldConfig.optional) {
					hasRequiredFields = false;
					missingRequiredFields.push(fieldName);
				}
			}

			results.push({
				item,
				fieldResults,
				hasRequiredFields,
				missingRequiredFields,
			});
		});

		return results;
	}, config.listing.items);

	const validItems = extractionResult.filter(
		(result: ExtractionResult) =>
			result.hasRequiredFields && Object.keys(result.item).length > 0,
	);
	const filteredItems = extractionResult.filter(
		(result: ExtractionResult) =>
			!result.hasRequiredFields || Object.keys(result.item).length === 0,
	);

	const filteredReasons: string[] = [];

	filteredItems.forEach((result: ExtractionResult) => {
		if (Object.keys(result.item).length === 0) {
			filteredReasons.push("Item contained no extractable data");
		} else if (!result.hasRequiredFields) {
			const missingFields = result.missingRequiredFields.join(", ");
			const itemIdentifier =
				result.item.title || result.item.url || "Unknown item";
			filteredReasons.push(
				`Item "${itemIdentifier}" missing required fields: ${missingFields}`,
			);
		} else {
			filteredReasons.push("Item failed validation");
		}
	});

	extractionResult.forEach((result: ExtractionResult, itemIndex: number) => {
		const itemIdentifier =
			result.item.title || result.item.url || `Item ${itemIndex + 1}`;

		Object.entries(result.fieldResults).forEach(([fieldName, fieldResult]) => {
			if (!fieldResult.success) {
				const fieldConfig = config.listing.items.fields[fieldName] as {
					selector: string;
					attribute: string;
					optional?: boolean;
				};
				const isOptional = fieldConfig?.optional || false;

				if (isOptional) {
					filteredReasons.push(
						`Optional field '${fieldName}' not found for "${itemIdentifier}"`,
					);
				} else {
					filteredReasons.push(
						`Required field '${fieldName}' not found for "${itemIdentifier}"`,
					);
				}
			}
		});
	});

	extractionResult.forEach((result: ExtractionResult, itemIndex: number) => {
		fieldStats.forEach((stat) => {
			stat.totalAttempts++;
			const fieldResult = result.fieldResults[stat.fieldName];
			if (fieldResult?.success) {
				stat.successCount++;
			} else {
				stat.missingItems.push(currentItemOffset + itemIndex + 1);
			}
		});
	});

	const crawledItems: CrawledData[] = validItems.map(
		(result: ExtractionResult) => {
			let publishedDate: string | undefined;
			try {
				publishedDate = result.item.date
					? parsePublishedDate(result.item.date)
					: undefined;
			} catch (error) {
				throw new Error(
					`Date parsing failed for item "${result.item.title || result.item.url}": ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}

			return {
				url: result.item.url || "",
				timestamp: new Date(),
				source: config.id,
				title: result.item.title || "",
				content: result.item.excerpt || "",
				author: result.item.author || undefined,
				publishedDate,
				image: result.item.image || undefined,
				metadata: {
					crawlerType: CRAWLER_TYPES.LISTING,
					configId: config.id,
					extractedFields: Object.keys(result.item),
				},
			};
		},
	);

	return {
		items: crawledItems,
		filteredCount: filteredItems.length,
		filteredReasons,
	};
}

export function createListingPageExtractor(): ListingPageExtractor {
	return {
		extractItemsFromPage,
	};
}
