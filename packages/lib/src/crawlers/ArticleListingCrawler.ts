import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
} from "@/core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "@/core/types.js";
import { generateContentHash } from "@/utils/hash.js";
import { DetailPageExtractor } from "./extractors/DetailPageExtractor.js";
import { ListingPageExtractor } from "./extractors/ListingPageExtractor.js";
import { PaginationHandler } from "./handlers/PaginationHandler.js";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

// Temporary crawl metadata for memory-efficient tracking
interface CrawlMetadata {
	sourceId: string;
	sourceName: string;
	startTime: Date;
	itemUrls: string[]; // Just URLs for final summary, not full items
	// Store basic item info for viewer access
	itemsForViewer: Array<{
		url: string;
		title: string;
		hash: string;
		publishedDate?: string;
	}>;
	duplicatesSkipped: number;
	totalFilteredItems: number;
	pagesProcessed: number;
	detailsCrawled: number;
	fieldStats: FieldExtractionStats[];
	detailFieldStats: FieldExtractionStats[];
	listingErrors: string[];
	detailErrors: string[];
	stoppedReason?: "max_pages" | "no_next_button" | "all_duplicates";
}

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
		// Create temporary file for tracking crawl metadata
		const tempFile = join(
			tmpdir(),
			`ethos-crawl-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`,
		);
		console.log(`📝 Using temporary metadata file: ${tempFile}`);

		// Register temp file for cleanup (if running in CLI context)
		try {
			const { registerTempFile } = await import("@/cli/index.js");
			registerTempFile(tempFile);
		} catch {
			// Not in CLI context, ignore
		}
		// Initialize crawl metadata
		const metadata: CrawlMetadata = {
			sourceId: config.id,
			sourceName: config.name,
			startTime,
			itemUrls: [],
			itemsForViewer: [],
			duplicatesSkipped: 0,
			totalFilteredItems: 0,
			pagesProcessed: 0,
			detailsCrawled: 0,
			fieldStats: Object.entries(config.listing.items.fields).map(
				([fieldName, fieldConfig]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: fieldConfig.optional || false,
					missingItems: [],
				}),
			),
			detailFieldStats: Object.entries(config.detail.fields).map(
				([fieldName]) => ({
					fieldName,
					successCount: 0,
					totalAttempts: 0,
					isOptional: true,
					missingItems: [],
				}),
			),
			listingErrors: [],
			detailErrors: [],
		};

		const seenUrls = new Set<string>();

		try {
			// Main pagination loop
			while (true) {
				// Check max pages limit before processing
				if (options.maxPages && metadata.pagesProcessed >= options.maxPages) {
					metadata.stoppedReason = "max_pages";
					break;
				}

				metadata.pagesProcessed++;

				// Extract items from current page
				const pageResult = await this.listingExtractor.extractItemsFromPage(
					page,
					config,
					metadata.fieldStats,
					metadata.itemUrls.length,
				);

				// Track filtered items
				metadata.totalFilteredItems += pageResult.filteredCount;
				metadata.listingErrors.push(...pageResult.filteredReasons);

				// Filter out duplicates and count them
				const newItems: CrawledData[] = [];
				let allItemsAreDuplicates = true;

				for (const item of pageResult.items) {
					if (seenUrls.has(item.url)) {
						metadata.duplicatesSkipped++;
					} else {
						seenUrls.add(item.url);
						metadata.itemUrls.push(item.url); // Only store URL for metadata
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
					metadata.stoppedReason = "all_duplicates";
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
						metadata.itemUrls.length - newItems.length, // Offset based on stored URLs
						concurrency,
					);
					metadata.detailsCrawled += newItems.length;

					// Navigate back to the listing page for pagination
					await page.goto(currentListingUrl, { waitUntil: "domcontentloaded" });

					// Process items immediately through storage callback
					if (options?.onPageComplete) {
						await options.onPageComplete(newItems);

						// After storage, capture the hash for each item for viewer access
						// Hash is generated from URL, so we can compute it the same way
						for (const item of newItems) {
							const hash = this.generateHash(item.url);
							metadata.itemsForViewer.push({
								url: item.url,
								title: item.title,
								hash,
								publishedDate: item.publishedDate,
							});
						}
					}

					// Write updated metadata to temp file
					writeFileSync(tempFile, JSON.stringify(metadata, null, 2));

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
					metadata.stoppedReason = "no_next_button";
					break;
				}
			}

			// Build final result from metadata
			return this.buildCrawlResultFromMetadata(metadata, tempFile);
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

	private buildCrawlResultFromMetadata(
		metadata: CrawlMetadata,
		tempFile?: string,
	): CrawlResult {
		// Sort items by published date (newest first) for viewer display
		metadata.itemsForViewer.sort((a, b) => {
			// Handle cases where publishedDate might be undefined
			const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
			const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;

			// Sort newest first (descending order)
			return dateB - dateA;
		});

		// Update the metadata file with sorted items
		if (tempFile) {
			writeFileSync(tempFile, JSON.stringify(metadata, null, 2));
		}

		const endTime = new Date();
		const summary: CrawlSummary = {
			sourceId: metadata.sourceId,
			sourceName: metadata.sourceName,
			itemsFound:
				metadata.itemUrls.length +
				metadata.duplicatesSkipped +
				metadata.totalFilteredItems,
			itemsProcessed: metadata.itemUrls.length,
			itemsWithErrors: metadata.totalFilteredItems,
			fieldStats: metadata.fieldStats,
			detailFieldStats: metadata.detailFieldStats,
			listingErrors: metadata.listingErrors,
			startTime: metadata.startTime,
			endTime,
			pagesProcessed: metadata.pagesProcessed,
			duplicatesSkipped: metadata.duplicatesSkipped,
			stoppedReason: metadata.stoppedReason,
			detailsCrawled: metadata.detailsCrawled,
			detailErrors: metadata.detailErrors,
		};

		// Return empty data array since all items were processed immediately
		// The actual data was stored via onPageComplete callback
		return {
			data: [], // Empty since items were processed and stored immediately
			summary: {
				...summary,
				// Include temp file path for viewer to access crawl metadata
				tempMetadataFile: tempFile,
			},
		};
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
			detailFieldStats,
			listingErrors,
			startTime,
			endTime,
			pagesProcessed,
			duplicatesSkipped,
			stoppedReason,
			detailsCrawled,
			detailErrors,
		};

		return {
			data: allCrawledItems,
			summary,
		};
	}

	/**
	 * Generate a content hash for the given data (SHA-1 for shorter 40-char hashes)
	 * This matches the ContentStore implementation for consistent hashing
	 */
	private generateHash(content: string): string {
		return generateContentHash(content);
	}
}
