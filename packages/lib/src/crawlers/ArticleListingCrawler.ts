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

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

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
			await page.goto(config.listing.url, { waitUntil: "networkidle2" });

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
		const allErrors: string[] = [];
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
			allErrors.push(...pageResult.filteredReasons);

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

			// If all items on this page were duplicates, stop
			if (pageResult.items.length > 0 && allItemsAreDuplicates) {
				stoppedReason = "all_duplicates";
				break;
			}

			allCrawledItems.push(...newItems);

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
			errors: allErrors,
			startTime,
			endTime,
			pagesProcessed,
			duplicatesSkipped,
			stoppedReason,
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
								value = element.textContent?.trim() || null;
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
		filteredItems.forEach((result) => {
			if (result.missingRequiredFields.length > 0) {
				filteredReasons.push(
					`Item ${currentItemOffset + extractionResult.indexOf(result) + 1}: missing required fields [${result.missingRequiredFields.join(", ")}]`,
				);
			}
		});

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
			excerpt: result.item.excerpt || undefined,
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

			// Click the next button and wait for navigation
			await nextButton.click();
			await page.waitForNavigation({ waitUntil: "networkidle2" });

			return true;
		} catch {
			// Navigation failed - probably no more pages
			return false;
		}
	}
}
