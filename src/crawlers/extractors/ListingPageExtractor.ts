import type { Page } from "puppeteer";
import {
	type CrawledData,
	CrawlerType,
	type FieldConfig,
	type FieldExtractionStats,
	type ListingConfig,
	type SourceConfig,
} from "@/core/types.js";
import { DYNAMIC_CONTENT_TIMEOUT } from "@/crawlers/extractors/constants";
import { parsePublishedDate } from "@/utils/date.js";
import type { ContentFieldName } from "./ContentPageExtractor";

export interface ListingExtractionResult {
	items: CrawledData[];
	excludedUrls: string[];
	filteredCount: number;
	filteredReasons: string[];
}

export interface ExtractedListingValues {
	title: string | null;
	url: string | null;
	publishedDate: string | null;
	author: string | null;
}
export type ListingFieldName = keyof ExtractedListingValues;

interface ExtractionResult {
	values: ExtractedListingValues;
	fieldResults: Record<
		ListingFieldName | ContentFieldName,
		{ success: boolean; value: string | null; error?: string }
	>;
	isExcluded: boolean;
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
		await page.waitForSelector(config.listing.container_selector, {
			timeout: DYNAMIC_CONTENT_TIMEOUT,
		});
	} catch (error) {
		console.warn(
			`Warning: Container selector "${config.listing.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds`,
			error,
		);
	}

	const excludeFunction = config.listing.shouldExcludeItem
		? config.listing.shouldExcludeItem
		: () => false;
	await page.exposeFunction("isExcluded", excludeFunction);

	const extractionResult = await page.evaluate(
		async (listingConfig: ListingConfig) => {
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
				let text: string | null = null;
				if (excludeSelectors && excludeSelectors.length > 0) {
					const cloned = element.cloneNode(true) as Element;
					for (const selector of excludeSelectors) {
						const excludedElements = cloned.querySelectorAll(selector);
						for (const excludedElement of excludedElements) {
							excludedElement.remove();
						}
					}
					text = cloned.textContent;
				} else {
					text = element.textContent;
				}
				return text?.replace(/\s+/g, " ").trim() || null;
			}

			const containers = document.querySelectorAll(
				listingConfig.container_selector,
			);
			const results: ExtractionResult[] = [];

			await Promise.all(
				[...containers].map(async (container) => {
					const extractedValues: ExtractedListingValues = {
						title: null,
						url: null,
						publishedDate: null,
						author: null,
					};
					const fieldResults: Record<
						string,
						{ success: boolean; value: string | null; error?: string }
					> = {};
					let hasRequiredFields = true;
					const missingRequiredFields: string[] = [];
					const extractionErrors: string[] = [];

					for (const [fieldName, fieldConfig] of Object.entries(
						listingConfig.fields,
					) as [ListingFieldName, FieldConfig][]) {
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
							const element = container.querySelector(
								typedFieldConfig.selector,
							);
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
							extractedValues[fieldName] = value;
						} else if (!typedFieldConfig.optional) {
							hasRequiredFields = false;
							missingRequiredFields.push(fieldName);
						}
					}

					const isExcluded = await (
						window as unknown as {
							isExcluded: (
								a: string,
								b: ExtractedListingValues,
							) => Promise<boolean>;
						}
					).isExcluded(container.outerHTML, extractedValues);
					console.log(isExcluded);

					results.push({
						values: extractedValues,
						fieldResults,
						isExcluded,
						hasRequiredFields,
						missingRequiredFields,
						extractionErrors,
					});
				}),
			);

			return results;
		},
		config.listing,
	);
	page.removeExposedFunction("isExcluded");

	const validItems = extractionResult.filter(
		(result: ExtractionResult) =>
			!result.isExcluded &&
			result.hasRequiredFields &&
			Object.keys(result.values).length > 0,
	);
	const filteredItems = extractionResult.filter(
		(result: ExtractionResult) =>
			result.isExcluded ||
			!result.hasRequiredFields ||
			Object.keys(result.values).length === 0,
	);

	extractItemsFromPage;
	const excludedUrls: string[] = [];
	const filteredReasons: string[] = [];

	filteredItems.forEach((result: ExtractionResult) => {
		if (result.isExcluded && result.values.url) {
			excludedUrls.push(result.values.url);
			return;
		}
		// Add extraction errors first
		if (result.extractionErrors.length > 0) {
			result.extractionErrors.forEach((error) => {
				filteredReasons.push(error);
			});
		}

		if (Object.keys(result.values).length === 0) {
			filteredReasons.push("Item contained no extractable data");
		} else if (!result.hasRequiredFields) {
			const missingFields = result.missingRequiredFields.join(", ");
			const itemIdentifier =
				result.values.url || result.values.title || "Unknown item";
			filteredReasons.push(
				`Item "${itemIdentifier}" missing required fields: ${missingFields}. Seen at ${page.url()}`,
			);
		} else {
			filteredReasons.push("Item failed validation");
		}
	});

	extractionResult
		.filter((result) => !result.isExcluded)
		.forEach((result: ExtractionResult, itemIndex: number) => {
			const itemIdentifier =
				result.values.url || result.values.title || `Item ${itemIndex + 1}`;

			Object.entries(result.fieldResults).forEach(
				([fieldName, fieldResult]) => {
					if (!fieldResult.success) {
						const fieldConfig = config.listing.fields[
							fieldName as ListingFieldName
						] as {
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
		if (result.isExcluded) return;
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
				publishedDate = result.values.publishedDate
					? parsePublishedDate(result.values.publishedDate)
					: undefined;
			} catch (error) {
				throw new Error(
					`Date parsing failed for item "${result.values.title || result.values.url}": ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}

			return {
				url: result.values.url || "",
				crawledAt: new Date(),
				source: config.id,
				title: result.values.title || "",
				content: "",
				author: result.values.author || undefined,
				publishedDate,
				metadata: {
					crawlerType: CrawlerType.Listing,
					configId: config.id,
					extractedFields: Object.keys(result.values),
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
