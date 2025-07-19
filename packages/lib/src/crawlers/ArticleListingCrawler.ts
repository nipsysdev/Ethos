import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type {
	CrawledData,
	Crawler,
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

	async crawl(config: SourceConfig): Promise<CrawlResult> {
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
		startTime: Date,
	): Promise<CrawlResult> {
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
			}> = [];

			containers.forEach((container) => {
				const item: Record<string, string | null> = {};
				const fieldResults: Record<
					string,
					{ success: boolean; value: string | null }
				> = {};
				let hasRequiredFields = true;

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
					}
				}

				if (hasRequiredFields && Object.keys(item).length > 0) {
					results.push({ item, fieldResults });
				}
			});

			return results;
		}, config.listing.items);

		// Update field stats based on extraction results
		extractionResult.forEach((result, itemIndex) => {
			fieldStats.forEach((stat) => {
				stat.totalAttempts++;
				const fieldResult = result.fieldResults[stat.fieldName];
				if (fieldResult?.success) {
					stat.successCount++;
				} else {
					stat.missingItems.push(itemIndex + 1);
				}
			});
		});

		const crawledItems: CrawledData[] = extractionResult.map((result) => ({
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

		const endTime = new Date();
		const summary: CrawlSummary = {
			sourceId: config.id,
			sourceName: config.name,
			itemsFound: extractionResult.length,
			itemsProcessed: crawledItems.length,
			itemsWithErrors: 0, // In current implementation, items with errors are filtered out
			fieldStats,
			errors: [],
			startTime,
			endTime,
		};

		return {
			data: crawledItems,
			summary,
		};
	}
}
