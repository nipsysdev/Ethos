import type { Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";
import { resolveAbsoluteUrl } from "@/utils/url.js";
import { createBrowserExtractionFunction } from "./BrowserFieldExtractor.js";
import {
	mergeContentData,
	updateFieldStats,
	updateItemMetadata,
} from "./ContentDataMapper.js";
import { DYNAMIC_CONTENT_TIMEOUT } from "./constants.js";

export interface ContentExtractionResult {
	contentData: Record<string, string | null>;
	errors: string[];
}

export class ContentPageExtractor {
	async extractFromContentPage(
		page: Page,
		url: string,
		config: SourceConfig,
	): Promise<ContentExtractionResult> {
		const contentData: Record<string, string | null> = {};
		const errors: string[] = [];

		if (!config.content?.fields) {
			return { contentData, errors };
		}

		try {
			// Make sure we have an absolute URL
			const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);

			// Navigate to the content page
			await page.goto(absoluteUrl, { waitUntil: "domcontentloaded" });

			// Wait for container elements to appear (handles dynamic content)
			if (config.content.container_selector) {
				try {
					await page.waitForSelector(config.content.container_selector, {
						timeout: DYNAMIC_CONTENT_TIMEOUT,
					});
				} catch {
					// If we can't find the container, continue anyway (might be an empty page)
					console.warn(
						`Warning: Content container selector "${config.content.container_selector}" not found within ${DYNAMIC_CONTENT_TIMEOUT / 1000} seconds for ${absoluteUrl}`,
					);
				}
			}

			// Extract fields from content page using the browser extraction function
			const extractionFunction = createBrowserExtractionFunction();
			const extractionResult = await page.evaluate(
				extractionFunction,
				config.content,
			);

			Object.assign(contentData, extractionResult.results);
			errors.push(...extractionResult.extractionErrors);
		} catch (error) {
			const absoluteUrl = resolveAbsoluteUrl(url, config.listing.url);
			errors.push(`Failed to load content page ${absoluteUrl}: ${error}`);
		}

		return { contentData, errors };
	}

	private filterExistingUrls(
		items: CrawledData[],
		metadataStore: MetadataStore,
	): { filteredItems: CrawledData[]; skippedCount: number } {
		// Use batch URL checking for much better performance
		const allUrls = items.map((item) => item.url);
		const existingUrls = metadataStore.getExistingUrls(allUrls);

		const filteredItems: CrawledData[] = [];
		let skippedCount = 0;

		for (const item of items) {
			if (existingUrls.has(item.url)) {
				skippedCount++;
			} else {
				filteredItems.push(item);
			}
		}

		return { filteredItems, skippedCount };
	}

	async extractContentPagesConcurrently(
		page: Page,
		items: CrawledData[],
		config: SourceConfig,
		itemOffset: number,
		concurrencyLimit: number = 5,
		metadataStore?: MetadataStore,
		skipExistingUrls: boolean = true,
		externalContentErrors?: string[],
		externalContentFieldStats?: FieldExtractionStats[],
	): Promise<void> {
		// Get browser instance to create additional pages for concurrency
		const browser = page.browser();

		// Filter out URLs that already exist in the database if enabled
		let itemsToProcess = items;
		let skippedCount = 0;

		if (skipExistingUrls && metadataStore) {
			const result = this.filterExistingUrls(items, metadataStore);
			itemsToProcess = result.filteredItems;
			skippedCount = result.skippedCount;

			if (skippedCount > 0) {
				console.log(
					`Skipped ${skippedCount} URLs already in database, processing ${itemsToProcess.length} new URLs`,
				);
			}
		}

		// If no items to process after filtering, return early
		if (itemsToProcess.length === 0) {
			console.log(
				"All URLs already exist in database, skipping content extraction",
			);
			return;
		}

		// Initialize tracking arrays - use external ones if provided (for legacy test compatibility)
		const contentErrors: string[] = externalContentErrors || [];
		const contentFieldStats: FieldExtractionStats[] =
			externalContentFieldStats || [];

		// Create a pool of pages for concurrent processing
		const pagePool: Page[] = [];
		try {
			// Calculate how many pages we need for concurrent processing
			// Never use the main page - it's needed for listing navigation
			const totalPagesNeeded = Math.min(
				concurrencyLimit,
				itemsToProcess.length,
			);

			// Create dedicated pages for content extraction only
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
			let completedCount = 0;
			while (itemIndex < itemsToProcess.length || runningTasks.size > 0) {
				// Start new tasks if we have available pages and items
				while (itemIndex < itemsToProcess.length && availablePages.size > 0) {
					const currentIndex = itemIndex++;
					const item = itemsToProcess[currentIndex];
					const pageIndex = Array.from(availablePages)[0];
					// Defensive check - should never happen given availablePages.size > 0 above
					if (pageIndex === undefined) {
						throw new Error(
							"No available page index found for content extraction.",
						);
					}
					availablePages.delete(pageIndex);

					const task = this.extractContentForSingleItem(
						pagePool[pageIndex],
						item,
						config,
						contentErrors,
						contentFieldStats,
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

						// Update progress
						completedCount++;
						if (
							completedCount % 5 === 0 ||
							completedCount === itemsToProcess.length
						) {
							console.log(
								`  Content extraction progress: ${completedCount}/${itemsToProcess.length} completed`,
							);
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
			// Clean up all created pages (all were created for content extraction)
			for (let i = 0; i < pagePool.length; i++) {
				await pagePool[i].close();
			}

			// Clear references to help garbage collection
			pagePool.length = 0;
		}
	}

	private async extractContentForSingleItem(
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
		itemIndex: number,
	): Promise<void> {
		if (!item.url) return;

		// Check if we have excerpt content from the listing page
		const hasExcerpt = item.content && item.content.trim().length > 0;

		try {
			const { contentData, errors } = await this.extractFromContentPage(
				page,
				item.url,
				config,
			);

			// Merge content data into the item
			mergeContentData(item, contentData);

			// Update field statistics and get field lists
			const { contentFields, failedContentFields } = updateFieldStats(
				contentData,
				contentFieldStats,
				itemIndex,
			);

			// Update item metadata
			updateItemMetadata(item, contentFields, failedContentFields, errors);

			// Handle errors based on whether we have an excerpt
			if (errors.length > 0) {
				if (hasExcerpt) {
					// If we have excerpt, treat content page errors as warnings
					console.warn(
						`Content extraction warnings for ${item.url} (excerpt available):`,
						errors.join(", "),
					);
					// Still add to errors array for tracking, but don't throw
					contentErrors.push(
						...errors.map(
							(err) => `Content extraction warning for ${item.url}: ${err}`,
						),
					);
				} else {
					// If no excerpt, content page errors are critical
					const errorMessage = `Critical: Content extraction failed for ${item.url} (no excerpt available): ${errors.join(", ")}`;
					contentErrors.push(errorMessage);
					throw new Error(errorMessage);
				}
			}
		} catch (error) {
			const errorMessage = `Failed to extract content data for ${item.url}: ${error}`;

			if (hasExcerpt) {
				// If we have excerpt, log warning but continue
				console.warn(
					`Content page failed for ${item.url}, but excerpt is available:`,
					error,
				);
				contentErrors.push(
					`Content extraction warning for ${item.url}: ${errorMessage}`,
				);
			} else {
				// If no excerpt, this is a critical error
				const criticalError = `Critical: ${errorMessage} (no excerpt available)`;
				contentErrors.push(criticalError);
				throw new Error(criticalError);
			}

			// Add error info to metadata
			updateItemMetadata(item, [], [], [errorMessage]);
		}
	}
}
