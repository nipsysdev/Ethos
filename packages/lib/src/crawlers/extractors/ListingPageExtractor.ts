import type { Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { parsePublishedDate } from "@/utils/date.js";
import { DYNAMIC_CONTENT_TIMEOUT } from "./constants.js";

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

export class ListingPageExtractor {
	async extractItemsFromPage(
		page: Page,
		config: SourceConfig,
		fieldStats: FieldExtractionStats[],
		currentItemOffset: number,
	): Promise<ListingExtractionResult> {
		// Wait for container elements to appear (handles dynamic content)
		try {
			await page.waitForSelector(config.listing.items.container_selector, {
				timeout: DYNAMIC_CONTENT_TIMEOUT,
			});
		} catch {
			// If we can't find any containers, continue anyway (might be an empty page)
			console.warn(
				`Warning: Container selector "${config.listing.items.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds`,
			);
		}

		// Extract all items using the container selector
		const extractionResult = await page.evaluate((itemsConfig) => {
			// NOTE: These helper functions are duplicated in ContentPageExtractor
			// This is intentional - page.evaluate() needs self-contained code
			// and sharing across the browser boundary adds unnecessary complexity

			// Inline helper for text extraction with exclusions
			function extractTextWithExclusions(
				element: Element,
				excludeSelectors?: string[],
			) {
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

			// Inline helper for field extraction
			function extractFieldValue(
				element: Element | null,
				fieldConfig: {
					selector: string;
					attribute: string;
					exclude_selectors?: string[];
					optional?: boolean;
				},
			) {
				if (!element) return null;

				if (fieldConfig.attribute === "text") {
					return extractTextWithExclusions(
						element,
						fieldConfig.exclude_selectors,
					);
				} else if (
					fieldConfig.attribute === "href" ||
					fieldConfig.attribute === "src"
				) {
					// For href and src attributes, get the absolute URL using the browser's URL resolution
					const urlValue = element.getAttribute(fieldConfig.attribute);
					if (!urlValue) return null;

					// Use the browser's built-in URL resolution to get absolute URLs
					try {
						return new URL(urlValue, window.location.href).href;
					} catch {
						// If URL construction fails, return the original value
						return urlValue;
					}
				} else {
					return element.getAttribute(fieldConfig.attribute);
				}
			}

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
						// Field extraction failed - success remains false, value remains null
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

		// Process results and track filtered items
		const validItems = extractionResult.filter(
			(result: ExtractionResult) =>
				result.hasRequiredFields && Object.keys(result.item).length > 0,
		);
		const filteredItems = extractionResult.filter(
			(result: ExtractionResult) =>
				!result.hasRequiredFields || Object.keys(result.item).length === 0,
		);

		// Update field stats based on extraction results
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
				// Parse the date - this will throw if parsing fails, which is what we want
				// to indicate that the source format has changed and needs code updates
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
			filteredReasons: [], // Could be enhanced later with specific filter reasons
		};
	}
}
