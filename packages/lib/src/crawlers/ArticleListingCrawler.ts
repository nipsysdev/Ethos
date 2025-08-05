import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type {
	CrawledData,
	Crawler,
	CrawlOptions,
	CrawlResult,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "@/core/types.js";
import { DetailPageExtractor } from "./extractors/DetailPageExtractor.js";
import { ListingPageExtractor } from "./extractors/ListingPageExtractor.js";
import { PaginationHandler } from "./handlers/PaginationHandler.js";
import { MetadataTracker } from "./MetadataTracker.js";

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
		// Initialize metadata tracker
		const metadataTracker = new MetadataTracker(config, startTime);
		const metadata = metadataTracker.getMetadata();

		const seenUrls = new Set<string>();

		try {
			// Main pagination loop
			while (true) {
				// Check max pages limit before processing
				if (options.maxPages && metadata.pagesProcessed >= options.maxPages) {
					metadataTracker.setStoppedReason("max_pages");
					break;
				}

				metadataTracker.incrementPagesProcessed();

				// Extract items from current page
				const pageResult = await this.listingExtractor.extractItemsFromPage(
					page,
					config,
					metadata.fieldStats,
					metadata.itemUrls.length,
				);

				// Track filtered items
				metadataTracker.addFilteredItems(
					pageResult.filteredCount,
					pageResult.filteredReasons,
				);

				// Filter out duplicates and count them
				const newItems: CrawledData[] = [];
				let allItemsAreDuplicates = true;

				for (const item of pageResult.items) {
					if (seenUrls.has(item.url)) {
						metadataTracker.addDuplicatesSkipped(1);
					} else {
						seenUrls.add(item.url);
						newItems.push(item);
						allItemsAreDuplicates = false;
					}
				}

				// Log page summary
				const duplicatesOnPage = pageResult.items.length - newItems.length;
				this.logPageSummary(
					metadata.pagesProcessed,
					pageResult,
					newItems.length,
					duplicatesOnPage,
				);

				// If all items on this page were duplicates, stop
				if (pageResult.items.length > 0 && allItemsAreDuplicates) {
					metadataTracker.setStoppedReason("all_duplicates");
					break;
				}

				// Extract detail data if we have new items
				if (newItems.length > 0) {
					// Store current listing page URL so we can return to it after detail extraction
					const currentListingUrl = page.url();

					const concurrency = options?.detailConcurrency ?? 5;
					console.log(
						`🔍 Extracting detail data for ${newItems.length} items (concurrency: ${concurrency})...`,
					);
					await this.detailExtractor.extractDetailData(
						page,
						newItems,
						config,
						metadata.detailErrors,
						metadata.detailFieldStats,
						metadata.itemUrls.length, // Current offset
						concurrency,
					);
					metadataTracker.addDetailsCrawled(newItems.length);

					// Navigate back to the listing page for pagination
					await page.goto(currentListingUrl, { waitUntil: "domcontentloaded" });

					// Process items immediately through storage callback
					if (options?.onPageComplete) {
						// Temporarily set the metadata tracker for this call
						const originalTracker = options.metadataTracker;
						options.metadataTracker = metadataTracker;

						await options.onPageComplete(newItems);

						// Restore original tracker
						options.metadataTracker = originalTracker;
					}

					// Add items to metadata tracking
					metadataTracker.addItems(newItems);

					// Checkpoint WAL files periodically to prevent them from growing too large
					// Do this after processing each page during long crawls
					metadataTracker.checkpoint();

					// Clear items from memory immediately after processing
					console.log(
						`🧹 Cleared ${newItems.length} items from memory after storage`,
					);
					newItems.length = 0; // Free memory
				}

				// Try to navigate to next page
				const hasNextPage = await this.paginationHandler.navigateToNextPage(
					page,
					config,
				);
				if (!hasNextPage) {
					metadataTracker.setStoppedReason("no_next_button");
					break;
				}
			}

			// Build final result from metadata tracker
			return metadataTracker.buildCrawlResult();
		} finally {
			// Keep temporary file for viewer access - it will be cleaned up later
			// Don't delete the temp file here anymore
		}
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
}
