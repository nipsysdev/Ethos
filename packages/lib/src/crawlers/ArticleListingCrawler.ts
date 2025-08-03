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
import { DetailPageExtractor } from "./extractors/DetailPageExtractor.js";
import { ListingPageExtractor } from "./extractors/ListingPageExtractor.js";
import { PaginationHandler } from "./handlers/PaginationHandler.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export class ArticleListingCrawler implements Crawler {
	type = CRAWLER_TYPES.LISTING;

	private listingExtractor = new ListingPageExtractor();
	private detailExtractor = new DetailPageExtractor();
	private paginationHandler = new PaginationHandler();

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
			const pageResult = await this.listingExtractor.extractItemsFromPage(
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
			const duplicatesOnPage = pageResult.items.length - newItems.length;
			this.logPageSummary(
				pagesProcessed,
				pageResult,
				newItems.length,
				duplicatesOnPage,
			);

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
				await this.detailExtractor.extractDetailData(
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

			// Call storage callback if provided (for immediate processing/storage)
			if (options?.onPageComplete && newItems.length > 0) {
				await options.onPageComplete(newItems);
			}

			// Try to navigate to next page
			const hasNextPage = await this.paginationHandler.navigateToNextPage(
				page,
				config,
			);
			if (!hasNextPage) {
				stoppedReason = "no_next_button";
				break;
			}
		}

		return this.buildCrawlResult(
			config,
			allCrawledItems,
			duplicatesSkipped,
			totalFilteredItems,
			fieldStats,
			detailFieldStats,
			listingErrors,
			detailErrors,
			startTime,
			pagesProcessed,
			stoppedReason,
			detailsCrawled,
			detailsSkipped,
		);
	}

	private logPageSummary(
		pagesProcessed: number,
		pageResult: { items: CrawledData[]; filteredCount: number },
		newItemsCount: number,
		duplicatesOnPage: number,
	): void {
		const totalItemsOnPage = pageResult.items.length;
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
	}

	private buildCrawlResult(
		config: SourceConfig,
		allCrawledItems: CrawledData[],
		duplicatesSkipped: number,
		totalFilteredItems: number,
		fieldStats: FieldExtractionStats[],
		detailFieldStats: FieldExtractionStats[],
		listingErrors: string[],
		detailErrors: string[],
		startTime: Date,
		pagesProcessed: number,
		stoppedReason:
			| "max_pages"
			| "no_next_button"
			| "all_duplicates"
			| undefined,
		detailsCrawled: number,
		detailsSkipped: number,
	): CrawlResult {
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
}
