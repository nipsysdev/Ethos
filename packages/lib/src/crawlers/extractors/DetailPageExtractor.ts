import type { Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { parsePublishedDate } from "@/utils/date.js";
import { resolveAbsoluteUrl } from "@/utils/url.js";

export interface DetailExtractionResult {
	detailData: Record<string, string | null>;
	errors: string[];
}

export class DetailPageExtractor {
	async extractFromDetailPage(
		page: Page,
		url: string,
		config: SourceConfig,
	): Promise<DetailExtractionResult> {
		const detailData: Record<string, string | null> = {};
		const errors: string[] = [];

		if (!config.detail?.fields) {
			return { detailData, errors };
		}

		try {
			// Make sure we have an absolute URL
			const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);

			// Navigate to the detail page
			await page.goto(absoluteUrl, { waitUntil: "domcontentloaded" });
			// Extract fields from detail page
			const extractionResult = await page.evaluate((detailConfig) => {
				// NOTE: These helper functions are duplicated in ListingPageExtractor
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
					fieldConfig: { attribute: string; exclude_selectors?: string[] },
				) {
					if (!element) return null;

					if (fieldConfig.attribute === "text") {
						return extractTextWithExclusions(
							element,
							fieldConfig.exclude_selectors,
						);
					} else {
						return element.getAttribute(fieldConfig.attribute);
					}
				}

				const results: Record<string, string | null> = {};
				const extractionErrors: string[] = [];

				// Determine the container to search within
				const containerElement = document.querySelector(
					detailConfig.container_selector,
				);
				if (!containerElement) {
					extractionErrors.push(
						`Container selector "${detailConfig.container_selector}" not found`,
					);
					return { results, extractionErrors };
				}

				for (const [fieldName, fieldConfig] of Object.entries(
					detailConfig.fields,
				)) {
					try {
						const typedFieldConfig = fieldConfig as {
							selector: string;
							attribute: string;
							exclude_selectors?: string[];
						};
						const element = containerElement.querySelector(
							typedFieldConfig.selector,
						);
						const value = extractFieldValue(element, typedFieldConfig);
						results[fieldName] = value && value !== "" ? value : null;
					} catch (error) {
						extractionErrors.push(`Failed to extract ${fieldName}: ${error}`);
						results[fieldName] = null;
					}
				}

				return { results, extractionErrors };
			}, config.detail);

			Object.assign(detailData, extractionResult.results);
			errors.push(...extractionResult.extractionErrors);
		} catch (error) {
			const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);
			errors.push(`Failed to load detail page ${absoluteUrl}: ${error}`);
		}

		return { detailData, errors };
	}

	async extractDetailData(
		page: Page,
		items: CrawledData[],
		config: SourceConfig,
		detailErrors: string[],
		detailFieldStats: FieldExtractionStats[],
		itemOffset: number,
		concurrencyLimit: number = 5,
	): Promise<void> {
		// Get browser instance to create additional pages for concurrency
		const browser = page.browser();

		// Create a pool of pages for concurrent processing
		const pagePool: Page[] = [];
		try {
			// Calculate how many pages we need for concurrent processing
			// Never use the main page - it's needed for listing navigation
			const totalPagesNeeded = Math.min(concurrencyLimit, items.length);

			// Create dedicated pages for detail extraction only
			for (let i = 0; i < totalPagesNeeded; i++) {
				const newPage = await browser.newPage();
				pagePool.push(newPage);
			}

			// Process items with proper concurrency control
			const availablePages = new Set<number>();
			const runningTasks = new Map<Promise<void>, number>();
			let itemIndex = 0;

			// Initialize available pages
			for (let i = 0; i < pagePool.length; i++) {
				availablePages.add(i);
			}

			// Process all items with controlled concurrency
			while (itemIndex < items.length || runningTasks.size > 0) {
				// Start new tasks if we have available pages and items
				while (itemIndex < items.length && availablePages.size > 0) {
					const currentIndex = itemIndex++;
					const item = items[currentIndex];
					const pageIndex = availablePages.values().next().value as number;
					availablePages.delete(pageIndex);

					const task = this.extractDetailForSingleItem(
						pagePool[pageIndex],
						item,
						config,
						detailErrors,
						detailFieldStats,
						itemOffset + currentIndex,
					);
					runningTasks.set(task, pageIndex);

					// Remove task and free up page when it completes
					task.finally(() => {
						const freedPageIndex = runningTasks.get(task);
						runningTasks.delete(task);
						if (freedPageIndex !== undefined) {
							availablePages.add(freedPageIndex);
						}
					});
				}

				// Wait for at least one task to complete before continuing
				if (runningTasks.size > 0) {
					await Promise.race([...runningTasks.keys()]);
				}
			}

			// Clear task tracking structures to help with garbage collection
			runningTasks.clear();
			availablePages.clear();
		} finally {
			// Clean up all created pages (all were created for detail extraction)
			for (let i = 0; i < pagePool.length; i++) {
				await pagePool[i].close();
			}

			// Clear references to help garbage collection
			pagePool.length = 0;
		}
	}

	private async extractDetailForSingleItem(
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		detailErrors: string[],
		detailFieldStats: FieldExtractionStats[],
		itemIndex: number,
	): Promise<void> {
		if (!item.url) return;

		try {
			const { detailData, errors } = await this.extractFromDetailPage(
				page,
				item.url,
				config,
			);

			// Merge detail data, overwriting listing data where detail data exists
			if (detailData.title) item.title = detailData.title;
			if (detailData.content) item.content = detailData.content;
			if (detailData.author) item.author = detailData.author;
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
			if (detailData.image) item.image = detailData.image;

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

			// Update metadata
			item.metadata = {
				...item.metadata,
				detailFieldsExtracted: detailFields,
				detailFieldsFailed: failedDetailFields,
				detailExtractionErrors: errors,
			};

			// Add errors to main error list
			if (errors.length > 0) {
				detailErrors.push(
					...errors.map((err) => `Detail extraction for ${item.url}: ${err}`),
				);
			}
		} catch (error) {
			const errorMessage = `Failed to extract detail data for ${item.url}: ${error}`;
			detailErrors.push(errorMessage);

			// Add error info to metadata
			item.metadata = {
				...item.metadata,
				detailExtractionErrors: [errorMessage],
			};
		}
	}
}
