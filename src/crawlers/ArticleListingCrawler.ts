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
import { ContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import { EXTRACTION_CONCURRENCY } from "@/crawlers/extractors/constants";
import { ListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor";
import { PaginationHandler } from "@/crawlers/handlers/PaginationHandler";
import { MetadataTracker } from "@/crawlers/MetadataTracker";
import { InterruptionHandler } from "@/crawlers/utils/InterruptionHandler";
import {
	filterByExclusion,
	filterDuplicates,
} from "@/crawlers/utils/UrlFilter";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

export class ArticleListingCrawler implements Crawler {
	type = CRAWLER_TYPES.LISTING;

	private listingExtractor = new ListingPageExtractor();
	private contentExtractor = new ContentPageExtractor();
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
			this.interruptionHandler.cleanup();
		}
	}

	private async extractItemsFromListing(
		page: Page,
		config: SourceConfig,
		options: CrawlOptions = {},
		startTime: Date,
	): Promise<CrawlResult> {
		const metadataTracker = new MetadataTracker(config, startTime);
		const metadata = metadataTracker.getMetadata();

		const seenUrls = new Set<string>();

		try {
			while (true) {
				// Single interruption check at the start of each loop
				if (this.checkForInterruption(metadataTracker)) break;

				// Check max pages limit before processing
				if (options.maxPages && metadata.pagesProcessed >= options.maxPages) {
					metadataTracker.setStoppedReason("max_pages");
					break;
				}

				metadataTracker.incrementPagesProcessed();

				const pageResult = await this.listingExtractor.extractItemsFromPage(
					page,
					config,
					metadata.fieldStats,
					metadata.itemsProcessed,
				);

				// Filter out URLs that match exclude patterns FIRST (before any error counting)
				const exclusionResult = filterByExclusion(
					pageResult.items,
					{
						excludePatterns: config.content_url_excludes,
						baseUrl: config.listing.url,
					},
					metadata.itemsProcessed,
				);

				const {
					filteredItems: filteredPageItems,
					excludedCount,
					excludedItemIndices,
				} = exclusionResult;

				// Track excluded URLs as filtered items (but not as errors)
				if (excludedCount > 0) {
					metadataTracker.addUrlsExcluded(excludedCount);
					// Remove field statistics for excluded URLs so they don't count as required field errors
					metadataTracker.removeFieldStatsForExcludedUrls(
						excludedCount,
						excludedItemIndices,
					);
				}

				metadataTracker.addFilteredItems(
					pageResult.filteredCount,
					pageResult.filteredReasons,
				);

				// Track field extraction warnings (including optional field failures)
				const fieldWarnings = pageResult.filteredReasons.filter(
					(reason) =>
						reason.includes("Optional field") ||
						reason.includes("Required field"),
				);
				if (fieldWarnings.length > 0) {
					metadataTracker.addFieldExtractionWarnings(fieldWarnings);
				}

				// Filter out duplicates and count them (use filtered items, not original)
				const newItems = filterDuplicates(filteredPageItems, seenUrls);
				const sessionDuplicatesSkipped =
					filteredPageItems.length - newItems.length;

				if (sessionDuplicatesSkipped > 0) {
					metadataTracker.addDuplicatesSkipped(sessionDuplicatesSkipped);
				}

				// Early database check to filter out URLs that already exist
				// This prevents unnecessary content page processing
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

				// Note: URL exclusion filtering is now done earlier, before duplicate checking

				// Check if all items (after exclusion, session and database deduplication) are duplicates
				if (
					filteredPageItems.length > 0 &&
					itemsToProcess.length === 0 &&
					options?.stopOnAllDuplicates !== false
				) {
					metadataTracker.setStoppedReason("all_duplicates");
					// Update logging to reflect database duplicates too
					const totalDuplicatesOnPage =
						filteredPageItems.length - newItems.length + dbDuplicatesSkipped;

					// Create updated page result that includes excluded URLs in filtered count
					const updatedPageResult = {
						...pageResult,
						filteredCount: pageResult.filteredCount + excludedCount,
					};

					this.logPageSummary(
						metadata.pagesProcessed,
						updatedPageResult,
						0, // No new items after database check
						totalDuplicatesOnPage,
						options?.maxPages,
						metadata, // Pass metadata for running totals
					);
					break;
				}

				const totalDuplicatesOnPage =
					filteredPageItems.length - newItems.length + dbDuplicatesSkipped;

				// Create updated page result that includes excluded URLs in filtered count
				const updatedPageResult = {
					...pageResult,
					filteredCount: pageResult.filteredCount + excludedCount,
				};

				this.logPageSummary(
					metadata.pagesProcessed,
					updatedPageResult,
					itemsToProcess.length,
					totalDuplicatesOnPage,
					options?.maxPages,
					metadata, // Pass metadata for running totals
				);

				if (itemsToProcess.length > 0) {
					// Store current listing page URL so we can return to it after content extraction
					const currentListingUrl = page.url();

					const concurrency =
						options?.contentConcurrency ??
						EXTRACTION_CONCURRENCY.HIGH_PERFORMANCE_LIMIT;
					const skipExisting = options?.skipExistingUrls ?? true;
					console.log(
						`Extracting content data for ${itemsToProcess.length} items (concurrency: ${concurrency})...`,
					);
					await this.contentExtractor.extractContentPagesConcurrently(
						page,
						itemsToProcess,
						config,
						metadata.itemsProcessed, // Current offset
						concurrency,
						metadataTracker.getMetadataStore(),
						skipExisting,
						metadata.contentErrors,
						metadata.contentFieldStats,
						metadataTracker, // Pass the tracker for storing filtering stats
					);
					metadataTracker.addContentsCrawled(itemsToProcess.length);

					if (metadata.contentErrors.length > 0) {
						metadataTracker.addContentErrors(metadata.contentErrors);
						// Clear the temporary array to avoid double-counting on subsequent pages
						metadata.contentErrors.length = 0;
					}

					const contentWarnings = metadata.contentErrors.filter(
						(error) =>
							error.includes("Optional field") || error.includes("not found"),
					);
					if (contentWarnings.length > 0) {
						metadataTracker.addFieldExtractionWarnings(contentWarnings);
					}

					await page.goto(currentListingUrl, { waitUntil: "domcontentloaded" });

					if (options?.onPageComplete) {
						// Temporarily set the metadata tracker for this call
						const originalTracker = options.metadataTracker;
						options.metadataTracker = metadataTracker;

						await options.onPageComplete(itemsToProcess);

						// Restore original tracker
						options.metadataTracker = originalTracker;
					}

					metadataTracker.addItems(itemsToProcess);

					// Checkpoint WAL files periodically to prevent them from growing too large
					// Do this after processing each page during long crawls
					metadataTracker.checkpoint();

					itemsToProcess.length = 0; // Free memory
				} else {
				}

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
		maxPages?: number,
		runningMetadata?: {
			itemsProcessed: number;
			duplicatesSkipped: number;
			totalFilteredItems: number;
		},
	): void {
		const totalItemsOnPage = pageResult.items.length;
		const filteredOnPage = pageResult.filteredCount;

		// Build progress indicator
		const progressInfo = maxPages
			? `${pagesProcessed}/${maxPages}`
			: `${pagesProcessed}`;

		console.log(
			`Page ${progressInfo}: found ${totalItemsOnPage + filteredOnPage} items`,
		);
		console.log(`  Processed ${newItemsCount} new items`);
		if (duplicatesOnPage > 0) {
			console.log(`  Skipped ${duplicatesOnPage} duplicates`);
		}
		if (filteredOnPage > 0) {
			console.log(`  Filtered out ${filteredOnPage} items`);
		}

		// Show running totals if metadata provided
		if (runningMetadata) {
			// The metadata already contains the cumulative totals including this page
			// So we just display the current totals directly
			console.log(
				`  Running totals: ${runningMetadata.itemsProcessed} processed, ${runningMetadata.duplicatesSkipped} duplicates, ${runningMetadata.totalFilteredItems} filtered`,
			);
		}
	}
}
