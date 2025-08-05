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
import { InterruptionHandler } from "./utils/InterruptionHandler.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export class ArticleListingCrawler implements Crawler {
	type = CRAWLER_TYPES.LISTING;

	private listingExtractor = new ListingPageExtractor();
	private detailExtractor = new DetailPageExtractor();
	private paginationHandler = new PaginationHandler();
	private interruptionHandler = new InterruptionHandler();

	private checkForInterruption(metadataTracker: MetadataTracker): boolean {
		if (this.interruptionHandler.isProcessInterrupted()) {
			metadataTracker.setStoppedReason("process_interrupted");
			return true;
		}
		return false;
	}

	async crawl(
		config: SourceConfig,
		options?: CrawlOptions,
	): Promise<CrawlResult> {
		const startTime = new Date();

		// Set up signal handlers for this crawl session
		this.interruptionHandler.setup();

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
			// Clean up signal handlers
			this.interruptionHandler.cleanup();
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
				// Single interruption check at the start of each loop
				if (this.checkForInterruption(metadataTracker)) break;

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
					metadata.itemsProcessed,
				);

				// Track filtered items
				metadataTracker.addFilteredItems(
					pageResult.filteredCount,
					pageResult.filteredReasons,
				);

				// Filter out duplicates and count them
				const newItems: CrawledData[] = [];

				for (const item of pageResult.items) {
					if (seenUrls.has(item.url)) {
						metadataTracker.addDuplicatesSkipped(1);
					} else {
						seenUrls.add(item.url);
						newItems.push(item);
					}
				}

				// Early database check to filter out URLs that already exist
				// This prevents unnecessary detail page processing
				let itemsToProcess = newItems;
				let dbDuplicatesSkipped = 0;

				if (newItems.length > 0 && options?.skipExistingUrls !== false) {
					const metadataStore = metadataTracker.getMetadataStore();
					if (metadataStore) {
						const allUrls = newItems.map((item) => item.url);
						const existingUrls = metadataStore.getExistingUrls(allUrls);

						if (existingUrls.size > 0) {
							itemsToProcess = newItems.filter(
								(item) => !existingUrls.has(item.url),
							);
							dbDuplicatesSkipped = newItems.length - itemsToProcess.length;

							// Track these as duplicates in metadata
							metadataTracker.addDuplicatesSkipped(dbDuplicatesSkipped);
						}
					}
				}

				// Check if all items (after both session and database deduplication) are duplicates
				if (
					pageResult.items.length > 0 &&
					itemsToProcess.length === 0 &&
					options?.stopOnAllDuplicates !== false
				) {
					metadataTracker.setStoppedReason("all_duplicates");
					// Update logging to reflect database duplicates too
					const totalDuplicatesOnPage =
						pageResult.items.length - newItems.length + dbDuplicatesSkipped;
					this.logPageSummary(
						metadata.pagesProcessed,
						pageResult,
						0, // No new items after database check
						totalDuplicatesOnPage,
					);
					break;
				}

				// Extract detail data if we have new items
				if (itemsToProcess.length > 0) {
					// Store current listing page URL so we can return to it after detail extraction
					const currentListingUrl = page.url();

					const concurrency = options?.detailConcurrency ?? 5;
					const skipExisting = options?.skipExistingUrls ?? true;
					console.log(
						`🔍 Extracting detail data for ${itemsToProcess.length} items (concurrency: ${concurrency})...`,
					);
					await this.detailExtractor.extractDetailData(
						page,
						itemsToProcess,
						config,
						metadata.detailErrors,
						metadata.detailFieldStats,
						metadata.itemsProcessed, // Current offset
						concurrency,
						metadataTracker.getMetadataStore(),
						skipExisting,
					);
					metadataTracker.addDetailsCrawled(itemsToProcess.length);

					// Navigate back to the listing page for pagination
					await page.goto(currentListingUrl, { waitUntil: "domcontentloaded" });

					// Process items immediately through storage callback
					if (options?.onPageComplete) {
						// Temporarily set the metadata tracker for this call
						const originalTracker = options.metadataTracker;
						options.metadataTracker = metadataTracker;

						await options.onPageComplete(itemsToProcess);

						// Restore original tracker
						options.metadataTracker = originalTracker;
					}

					// Add items to metadata tracking
					metadataTracker.addItems(itemsToProcess);

					// Checkpoint WAL files periodically to prevent them from growing too large
					// Do this after processing each page during long crawls
					metadataTracker.checkpoint();

					itemsToProcess.length = 0; // Free memory
				} else {
					// Log page summary even when no items to process
					const totalDuplicatesOnPage =
						pageResult.items.length - newItems.length + dbDuplicatesSkipped;
					this.logPageSummary(
						metadata.pagesProcessed,
						pageResult,
						0, // No new items after database check
						totalDuplicatesOnPage,
					);
				}

				// Try to navigate to next page
				const hasNextPage = await this.paginationHandler.navigateToNextPage(
					page,
					config,
				);

				// Check for interruption - if interrupted, it takes precedence over no next page
				if (this.checkForInterruption(metadataTracker)) break;

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
