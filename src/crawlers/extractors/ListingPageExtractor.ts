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
	excludedUrls: string[];
	filteredCount: number;
	filteredReasons: string[];
}

interface ExtractionResult {
	item: Record<string, string | null>;
	fieldResults: Record<
		string,
		{ success: boolean; value: string | null; error?: string }
	>;
	hasExcludedUrl: boolean;
	hasRequiredFields: boolean;
	missingRequiredFields: string[];
	extractionErrors: string[];
}

export interface ListingPageExtractor {
	extractItemsFromPage: (
		page: Page,
		config: SourceConfig,
		fieldStats: FieldExtractionStats[],
		currentItemOffset: number,
	) => Promise<ListingExtractionResult>;
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
	} catch (error) {
		console.warn(
			`Warning: Container selector "${config.listing.items.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds`,
			error,
		);
	}

	const extractionResult = await page.evaluate(
		(itemsConfig, excludedUrlPaths) => {
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
					return extractTextWithExclusions(
						element,
						fieldConfig.exclude_selectors,
					);
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

			const containers = document.querySelectorAll(
				itemsConfig.container_selector,
			);
			const results: ExtractionResult[] = [];

			containers.forEach((container) => {
				const item: Record<string, string | null> = {};
				const fieldResults: Record<
					string,
					{ success: boolean; value: string | null; error?: string }
				> = {};
				let hasRequiredFields = true;
				const missingRequiredFields: string[] = [];
				const extractionErrors: string[] = [];

				for (const [fieldName, fieldConfig] of Object.entries(
					itemsConfig.fields,
				)) {
					let success = false;
					let value: string | null = null;
					let error: string | undefined;

					const typedFieldConfig = fieldConfig as {
						selector: string;
						attribute: string;
						exclude_selectors?: string[];
						optional?: boolean;
					};

					try {
						const element = container.querySelector(typedFieldConfig.selector);
						if (element) {
							value = extractFieldValue(element, typedFieldConfig);
						}
						success = value !== null && value !== "";
					} catch (err) {
						error =
							err instanceof Error
								? err.message
								: `Unknown error extracting field ${fieldName}`;
						extractionErrors.push(
							`Field '${fieldName}' extraction failed: ${error}`,
						);
					}

					fieldResults[fieldName] = { success, value, error };

					if (success) {
						item[fieldName] = value;
					} else if (!typedFieldConfig.optional) {
						hasRequiredFields = false;
						missingRequiredFields.push(fieldName);
					}
				}

				const hasExcludedUrl = !!excludedUrlPaths.filter((path) =>
					item.url?.includes(path),
				).length;

				results.push({
					item,
					fieldResults,
					hasExcludedUrl,
					hasRequiredFields,
					missingRequiredFields,
					extractionErrors,
				});
			});

			return results;
		},
		config.listing.items,
		config.content_url_excludes ?? [],
	);

	const validItems = extractionResult.filter(
		(result: ExtractionResult) =>
			!result.hasExcludedUrl &&
			result.hasRequiredFields &&
			Object.keys(result.item).length > 0,
	);
	const filteredItems = extractionResult.filter(
		(result: ExtractionResult) =>
			result.hasExcludedUrl ||
			!result.hasRequiredFields ||
			Object.keys(result.item).length === 0,
	);
	extractItemsFromPage;
	const excludedUrls: string[] = [];
	const filteredReasons: string[] = [];

	filteredItems.forEach((result: ExtractionResult) => {
		if (result.hasExcludedUrl && result.item.url) {
			excludedUrls.push(result.item.url);
			return;
		}
		// Add extraction errors first
		if (result.extractionErrors.length > 0) {
			result.extractionErrors.forEach((error) => {
				filteredReasons.push(error);
			});
		}

		if (Object.keys(result.item).length === 0) {
			filteredReasons.push("Item contained no extractable data");
		} else if (!result.hasRequiredFields) {
			const missingFields = result.missingRequiredFields.join(", ");
			const itemIdentifier =
				result.item.url || result.item.title || "Unknown item";
			filteredReasons.push(
				`Item "${itemIdentifier}" missing required fields: ${missingFields}`,
			);
		} else {
			filteredReasons.push("Item failed validation");
		}
	});

	extractionResult
		.filter((result) => !result.hasExcludedUrl)
		.forEach((result: ExtractionResult, itemIndex: number) => {
			const itemIdentifier =
				result.item.url || result.item.title || `Item ${itemIndex + 1}`;

			Object.entries(result.fieldResults).forEach(
				([fieldName, fieldResult]) => {
					if (!fieldResult.success) {
						const fieldConfig = config.listing.items.fields[fieldName] as {
							selector: string;
							attribute: string;
							optional?: boolean;
						};
						const isOptional = fieldConfig?.optional || false;

						if (fieldResult.error) {
							return;
						}

						if (!isOptional) {
							filteredReasons.push(
								`Required field '${fieldName}' not found for "${itemIdentifier}". Seen at "${page.url()}"`,
							);
						}
					}
				},
			);
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
				crawledAt: new Date(),
				source: config.id,
				title: result.item.title || "",
				content: result.item.excerpt || "",
				author: result.item.author || undefined,
				publishedDate,
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
		excludedUrls,
		filteredCount: filteredItems.length,
		filteredReasons,
	};
}

export function createListingPageExtractor(): ListingPageExtractor {
	return {
		extractItemsFromPage,
	};
}
