import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type {
	CrawledData,
	Crawler,
	CrawlOptions,
	CrawlResult,
	CrawlSummary,
	FieldExtractionStats,
	SourceConfig,
} from "../core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "../core/types.js";
import { resolveAbsoluteUrl } from "../utils/url.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

// Timeout constants for pagination handling
const NAVIGATION_TIMEOUT_MS = 3000; // Time to wait for page navigation
const CONTAINER_WAIT_TIMEOUT_MS = 5000; // Time to wait for container selector after navigation

export class ArticleListingCrawler implements Crawler {
	type = CRAWLER_TYPES.LISTING;

	async crawl(
		config: SourceConfig,
		options?: CrawlOptions,
	): Promise<CrawlResult> {
		const startTime = new Date();

		if (config.type !== CRAWLER_TYPES.LISTING) {
			throw new CrawlerError(
				`Config type must be '${CRAWLER_TYPES.LISTING}' (only supported type in Phase 1)`,
				config.id,
			);
		}

		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		try {
			const page = await browser.newPage();
			await page.goto(config.listing.url, { waitUntil: "domcontentloaded" });

			const result = await this.extractItemsFromListing(
				page,
				config,
				options,
				startTime,
			);

			return result;
		} catch (error) {
			throw new CrawlerError(
				`Failed to crawl ${config.name}`,
				config.id,
				error instanceof Error ? error : new Error(String(error)),
			);
		} finally {
			await browser.close();
		}
	}

	private async extractItemsFromListing(
		page: Page,
		config: SourceConfig,
		options: CrawlOptions = {},
		startTime: Date,
	): Promise<CrawlResult> {
		const allCrawledItems: CrawledData[] = [];
		const seenUrls = new Set<string>();
		let pagesProcessed = 0;
		let duplicatesSkipped = 0;
		let totalFilteredItems = 0;
		let detailsCrawled = 0;
		let detailsSkipped = 0;
		const detailErrors: string[] = [];
		const listingErrors: string[] = [];
		let stoppedReason:
			| "max_pages"
			| "no_next_button"
			| "all_duplicates"
			| undefined;

		// Initialize field stats tracking
		const fieldStats: FieldExtractionStats[] = Object.entries(
			config.listing.items.fields,
		).map(([fieldName, fieldConfig]) => ({
			fieldName,
			successCount: 0,
			totalAttempts: 0,
			isOptional: fieldConfig.optional || false,
			missingItems: [],
		}));

		// Initialize detail field stats tracking
		const detailFieldStats: FieldExtractionStats[] = config.detail?.fields
			? Object.entries(config.detail.fields).map(([fieldName]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: true, // All detail fields are effectively optional since we fall back to listing data
					missingItems: [],
				}))
			: [];

		// Main pagination loop
		while (true) {
			// Check max pages limit before processing
			if (options.maxPages && pagesProcessed >= options.maxPages) {
				stoppedReason = "max_pages";
				break;
			}

			pagesProcessed++;

			// Extract items from current page
			const pageResult = await this.extractItemsFromPage(
				page,
				config,
				fieldStats,
				allCrawledItems.length,
			);

			// Track filtered items
			totalFilteredItems += pageResult.filteredCount;
			listingErrors.push(...pageResult.filteredReasons);

			// Filter out duplicates and count them
			const newItems: CrawledData[] = [];
			let allItemsAreDuplicates = true;

			for (const item of pageResult.items) {
				if (seenUrls.has(item.url)) {
					duplicatesSkipped++;
				} else {
					seenUrls.add(item.url);
					newItems.push(item);
					allItemsAreDuplicates = false;
				}
			}

			// Log page summary
			const totalItemsOnPage = pageResult.items.length;
			const newItemsCount = newItems.length;
			const duplicatesOnPage = totalItemsOnPage - newItemsCount;
			const filteredOnPage = pageResult.filteredCount;

			console.log(
				`📄 Page ${pagesProcessed}: found ${totalItemsOnPage + filteredOnPage} items`,
			);
			console.log(`   ✅ Processed ${newItemsCount} new items`);
			if (duplicatesOnPage > 0) {
				console.log(`   ⏭️  Skipped ${duplicatesOnPage} duplicates`);
			}
			if (filteredOnPage > 0) {
				console.log(`   🚫 Filtered out ${filteredOnPage} items`);
			}

			// If all items on this page were duplicates, stop
			if (pageResult.items.length > 0 && allItemsAreDuplicates) {
				stoppedReason = "all_duplicates";
				break;
			}

			allCrawledItems.push(...newItems);

			// Extract detail data if not skipped and config has detail section
			if (!options?.skipDetails && config.detail && newItems.length > 0) {
				// Store current listing page URL so we can return to it after detail extraction
				const currentListingUrl = page.url();

				console.log(
					`🔍 Extracting detail data for ${newItems.length} items...`,
				);
				await this.extractDetailData(
					page,
					newItems,
					config,
					detailErrors,
					detailFieldStats,
					allCrawledItems.length,
				);
				detailsCrawled += newItems.length;

				// Navigate back to the listing page for pagination
				await page.goto(currentListingUrl, { waitUntil: "domcontentloaded" });
			} else if (options?.skipDetails) {
				detailsSkipped += newItems.length;
			}

			// Try to navigate to next page
			const hasNextPage = await this.navigateToNextPage(page, config);
			if (!hasNextPage) {
				stoppedReason = "no_next_button";
				break;
			}
		}

		const endTime = new Date();
		const summary: CrawlSummary = {
			sourceId: config.id,
			sourceName: config.name,
			itemsFound:
				allCrawledItems.length + duplicatesSkipped + totalFilteredItems,
			itemsProcessed: allCrawledItems.length,
			itemsWithErrors: totalFilteredItems,
			fieldStats,
			detailFieldStats:
				detailFieldStats.length > 0 ? detailFieldStats : undefined,
			listingErrors,
			startTime,
			endTime,
			pagesProcessed,
			duplicatesSkipped,
			stoppedReason,
			detailsCrawled,
			detailsSkipped,
			detailErrors,
		};

		return {
			data: allCrawledItems,
			summary,
		};
	}

	private async extractItemsFromPage(
		page: Page,
		config: SourceConfig,
		fieldStats: FieldExtractionStats[],
		currentItemOffset: number,
	): Promise<{
		items: CrawledData[];
		filteredCount: number;
		filteredReasons: string[];
	}> {
		// Extract all items using the container selector
		// Note: The function below runs in the browser context and must be self-contained
		const extractionResult = await page.evaluate((itemsConfig) => {
			const containers = document.querySelectorAll(
				itemsConfig.container_selector,
			);
			const results: Array<{
				item: Record<string, string | null>;
				fieldResults: Record<
					string,
					{ success: boolean; value: string | null }
				>;
				hasRequiredFields: boolean;
				missingRequiredFields: string[];
			}> = [];

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

					try {
						const element = container.querySelector(fieldConfig.selector);

						if (element) {
							if (fieldConfig.attribute === "text") {
								// Handle exclusions for listing page text extraction
								if (
									fieldConfig.exclude_selectors &&
									fieldConfig.exclude_selectors.length > 0
								) {
									const cloned = element.cloneNode(true) as Element;
									for (const selector of fieldConfig.exclude_selectors) {
										const excludedElements = cloned.querySelectorAll(selector);
										for (const excludedElement of excludedElements) {
											excludedElement.remove();
										}
									}
									value =
										cloned.textContent?.trim().replace(/\s+/g, " ") || null;
								} else {
									value =
										element.textContent?.trim().replace(/\s+/g, " ") || null;
								}
							} else {
								value = element.getAttribute(fieldConfig.attribute);
							}
						}

						success = value !== null && value !== "";
					} catch {
						// Field extraction failed - success remains false, value remains null
					}

					fieldResults[fieldName] = { success, value };

					if (success) {
						item[fieldName] = value;
					} else if (!fieldConfig.optional) {
						hasRequiredFields = false;
						missingRequiredFields.push(fieldName);
					}
				}

				// Always add to results so we can track what got filtered
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
			(result) =>
				result.hasRequiredFields && Object.keys(result.item).length > 0,
		);
		const filteredItems = extractionResult.filter(
			(result) =>
				!result.hasRequiredFields || Object.keys(result.item).length === 0,
		);

		const filteredReasons: string[] = [];

		// Update field stats based on extraction results (all items, not just valid ones)
		extractionResult.forEach((result, itemIndex) => {
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

		const crawledItems: CrawledData[] = validItems.map((result) => ({
			url: result.item.url || "",
			timestamp: new Date(),
			source: config.id,
			title: result.item.title || "",
			content: result.item.excerpt || "",
			author: result.item.author || undefined,
			publishedDate: result.item.date || undefined,
			image: result.item.image || undefined,
			tags: [],
			metadata: {
				crawlerType: this.type,
				configId: config.id,
				extractedFields: Object.keys(result.item),
			},
		}));

		return {
			items: crawledItems,
			filteredCount: filteredItems.length,
			filteredReasons,
		};
	}

	private async navigateToNextPage(
		page: Page,
		config: SourceConfig,
	): Promise<boolean> {
		const nextButtonSelector = config.listing.pagination?.next_button_selector;

		if (!nextButtonSelector) {
			return false;
		}

		try {
			// Check if next button exists and is clickable
			const nextButton = await page.$(nextButtonSelector);
			if (!nextButton) {
				return false;
			}

			// Check if button is disabled or hidden
			const isDisabled = await page.evaluate((selector) => {
				const element = document.querySelector(selector);
				if (!element) return true;

				// Check various ways a button might be disabled
				const htmlElement = element as HTMLElement;
				const isHidden = htmlElement.offsetParent === null;
				const hasDisabledAttr = element.hasAttribute("disabled");
				const hasDisabledClass = element.classList.contains("disabled");
				const hasAriaDisabled =
					element.getAttribute("aria-disabled") === "true";

				return (
					isHidden || hasDisabledAttr || hasDisabledClass || hasAriaDisabled
				);
			}, nextButtonSelector);

			if (isDisabled) {
				return false;
			}

			// Click the next button - handle both traditional navigation and AJAX pagination
			await nextButton.click();

			// Try to wait for navigation, but don't fail if it's AJAX-based pagination
			try {
				await page.waitForNavigation({
					waitUntil: "domcontentloaded",
					timeout: NAVIGATION_TIMEOUT_MS,
				});
			} catch {
				// No navigation occurred - likely AJAX pagination, continue anyway
			}

			// Wait for the container selector to be available (works for both navigation types)
			// This ensures dynamic content has loaded before we try to extract items
			await page.waitForSelector(config.listing.items.container_selector, {
				timeout: CONTAINER_WAIT_TIMEOUT_MS,
			});

			return true;
		} catch {
			// Navigation failed - this is expected when we reach the last page
			// Common causes: button click fails, navigation timeout, no next page exists
			return false;
		}
	}

	private async extractFromDetailPage(
		page: Page,
		url: string,
		config: SourceConfig,
	): Promise<{
		detailData: Record<string, string | null>;
		errors: string[];
	}> {
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
						const element = containerElement.querySelector(
							fieldConfig.selector,
						);
						let value: string | null = null;

						if (element) {
							if (fieldConfig.attribute === "text") {
								// Handle exclusions for detail page text extraction
								if (
									fieldConfig.exclude_selectors &&
									fieldConfig.exclude_selectors.length > 0
								) {
									const cloned = element.cloneNode(true) as Element;
									for (const selector of fieldConfig.exclude_selectors) {
										const excludedElements = cloned.querySelectorAll(selector);
										for (const excludedElement of excludedElements) {
											excludedElement.remove();
										}
									}
									value =
										cloned.textContent?.trim().replace(/\s+/g, " ") || null;
								} else {
									value =
										element.textContent?.trim().replace(/\s+/g, " ") || null;
								}
							} else {
								value = element.getAttribute(fieldConfig.attribute);
							}
						}

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

	private async extractDetailData(
		page: Page,
		items: CrawledData[],
		config: SourceConfig,
		detailErrors: string[],
		detailFieldStats: FieldExtractionStats[],
		itemOffset: number,
	): Promise<void> {
		for (const [itemIndex, item] of items.entries()) {
			if (!item.url) continue;

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
				if (detailData.date) item.publishedDate = detailData.date;
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
						stat.missingItems.push(itemOffset + itemIndex + 1);
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
}
