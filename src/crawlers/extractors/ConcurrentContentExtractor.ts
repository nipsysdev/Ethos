import type { Browser, Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";
import type { ContentPageExtractor } from "./ContentPageExtractor.js";

/**
 * Configuration for concurrent content extraction
 */
export interface ConcurrentExtractionConfig {
	concurrencyLimit: number;
	skipExistingUrls: boolean;
	metadataStore?: MetadataStore;
	externalContentErrors?: string[];
	externalContentFieldStats?: FieldExtractionStats[];
	metadataTracker?: {
		addDuplicatesSkipped: (count: number) => void;
		addUrlsExcluded: (count: number) => void;
	};
}

/**
 * Manages concurrent content extraction with proper resource pooling and error handling.
 * Extracted from ContentPageExtractor to improve maintainability and testability.
 */
export class ConcurrentContentExtractor {
	private readonly contentExtractor: ContentPageExtractor;

	constructor(contentExtractor: ContentPageExtractor) {
		this.contentExtractor = contentExtractor;
	}

	/**
	 * Extract content from multiple URLs concurrently using a page pool
	 */
	async extractConcurrently(
		mainPage: Page,
		items: CrawledData[],
		config: SourceConfig,
		itemOffset: number,
		extractConfig: ConcurrentExtractionConfig,
	): Promise<void> {
		const {
			concurrencyLimit,
			skipExistingUrls,
			metadataStore,
			externalContentErrors,
			externalContentFieldStats,
			metadataTracker,
		} = extractConfig;

		// Filter out URLs that already exist in the database if enabled
		const itemsToProcess = this.filterExistingUrls(
			items,
			metadataStore,
			skipExistingUrls,
			metadataTracker,
		);

		// If no items to process after filtering, return early
		if (itemsToProcess.length === 0) {
			console.log("All URLs filtered out, skipping content extraction");
			return;
		}

		// Initialize tracking arrays
		const contentErrors: string[] = externalContentErrors || [];
		const contentFieldStats: FieldExtractionStats[] =
			externalContentFieldStats || [];

		const browser = mainPage.browser();
		const pagePool = await this.createPagePool(
			browser,
			concurrencyLimit,
			itemsToProcess.length,
		);

		try {
			await this.processItemsConcurrently(
				pagePool,
				itemsToProcess,
				config,
				itemOffset,
				contentErrors,
				contentFieldStats,
			);
		} finally {
			await this.cleanupPagePool(pagePool);
		}
	}

	/**
	 * Filter out URLs that already exist in the database
	 */
	private filterExistingUrls(
		items: CrawledData[],
		metadataStore?: MetadataStore,
		skipExistingUrls: boolean = true,
		metadataTracker?: {
			addDuplicatesSkipped: (count: number) => void;
		},
	): CrawledData[] {
		if (!skipExistingUrls || !metadataStore) {
			return items;
		}

		// Use batch URL checking for better performance
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

		if (skippedCount > 0 && metadataTracker) {
			metadataTracker.addDuplicatesSkipped(skippedCount);
		}

		return filteredItems;
	}

	/**
	 * Create a pool of browser pages for concurrent processing
	 */
	private async createPagePool(
		browser: Browser,
		concurrencyLimit: number,
		itemCount: number,
	): Promise<Page[]> {
		const totalPagesNeeded = Math.min(concurrencyLimit, itemCount);
		const pagePool: Page[] = [];

		for (let i = 0; i < totalPagesNeeded; i++) {
			const newPage = await browser.newPage();
			pagePool.push(newPage);
		}

		return pagePool;
	}

	/**
	 * Process items concurrently using the page pool
	 */
	private async processItemsConcurrently(
		pagePool: Page[],
		items: CrawledData[],
		config: SourceConfig,
		itemOffset: number,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
	): Promise<void> {
		const availablePages = new Set<number>();
		const runningTasks = new Map<Promise<void>, number>();
		let itemIndex = 0;
		let completedCount = 0;

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
				const pageIndex = this.getAvailablePageIndex(availablePages);

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

				// Handle task completion
				task.finally(() => {
					const freedPageIndex = runningTasks.get(task);
					runningTasks.delete(task);
					if (freedPageIndex !== undefined) {
						availablePages.add(freedPageIndex);
					}

					completedCount++;
					this.logProgress(completedCount, items.length);
				});
			}

			// Wait for at least one task to complete before continuing
			if (runningTasks.size > 0) {
				await Promise.race([...runningTasks.keys()]);
			}
		}

		// Clear tracking structures for garbage collection
		runningTasks.clear();
		availablePages.clear();
	}

	/**
	 * Get the first available page index
	 */
	private getAvailablePageIndex(
		availablePages: Set<number>,
	): number | undefined {
		return Array.from(availablePages)[0];
	}

	/**
	 * Log extraction progress
	 */
	private logProgress(completedCount: number, totalCount: number): void {
		if (completedCount % 5 === 0 || completedCount === totalCount) {
			console.log(
				`  Content extraction progress: ${completedCount}/${totalCount} completed`,
			);
		}
	}

	/**
	 * Extract content for a single item (delegates to ContentPageExtractor)
	 */
	private async extractContentForSingleItem(
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
		itemIndex: number,
	): Promise<void> {
		// Delegate to the original ContentPageExtractor logic
		// This maintains the existing behavior while improving structure
		return this.contentExtractor.extractContentForSingleItem(
			page,
			item,
			config,
			contentErrors,
			contentFieldStats,
			itemIndex,
		);
	}

	/**
	 * Clean up the page pool
	 */
	private async cleanupPagePool(pagePool: Page[]): Promise<void> {
		for (const page of pagePool) {
			await page.close();
		}
		pagePool.length = 0;
	}
}
