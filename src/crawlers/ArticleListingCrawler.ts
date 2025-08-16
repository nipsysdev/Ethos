import type { Page, Browser as PuppeteerBrowser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type {
	CrawledData,
	Crawler,
	CrawlOptions,
	CrawlResult,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "@/core/types.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import type { ContentExtractionResult } from "@/crawlers/extractors/ContentPageExtractor.js";
import { EXTRACTION_CONCURRENCY } from "@/crawlers/extractors/constants";
import {
	createListingPageExtractor,
	type ListingPageExtractor,
} from "@/crawlers/extractors/ListingPageExtractor";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler";
import {
	createMetadataTracker,
	type MetadataTracker,
	StoppedReason,
} from "@/crawlers/MetadataTracker";
import type { InterruptionHandler } from "@/crawlers/utils/InterruptionHandler";
import { createInterruptionHandler } from "@/crawlers/utils/InterruptionHandler";
import {
	filterByExclusion,
	filterDuplicates,
} from "@/crawlers/utils/UrlFilter";
import type { MetadataStore } from "@/storage/MetadataStore.js";

interface ContentPageExtractor {
	extractContentPagesConcurrently: (
		page: Page,
		items: CrawledData[],
		config: SourceConfig,
		itemOffset: number,
		concurrencyLimit: number,
		metadataStore?: MetadataStore,
		skipExistingUrls?: boolean,
		externalContentErrors?: string[],
		externalContentFieldStats?: FieldExtractionStats[],
		metadataTracker?: {
			addDuplicatesSkipped: (count: number) => void;
			addUrlsExcluded: (count: number) => void;
		},
	) => Promise<void>;
	extractFromContentPage: (
		page: Page,
		url: string,
		config: SourceConfig,
	) => Promise<ContentExtractionResult>;
	extractContentForSingleItem: (
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
		itemIndex: number,
	) => Promise<void>;
}

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());

async function createBrowser() {
	return await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});
}

async function setupPage(browser: PuppeteerBrowser, url: string) {
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "domcontentloaded" });
	return page;
}

function checkForInterruption(
	interruptionHandler: InterruptionHandler,
	metadataTracker: MetadataTracker,
): boolean {
	if (interruptionHandler.isProcessInterrupted()) {
		metadataTracker.setStoppedReason(StoppedReason.PROCESS_INTERRUPTED);
		return true;
	}
	return false;
}

async function processPageItems(
	page: Page,
	config: SourceConfig,
	options: CrawlOptions,
	metadataTracker: MetadataTracker,
	seenUrls: Set<string>,
	listingExtractor: ListingPageExtractor,
) {
	const metadata = metadataTracker.getMetadata();

	const pageResult = await listingExtractor.extractItemsFromPage(
		page,
		config,
		metadata.fieldStats,
		metadata.itemsProcessed,
	);

	// Filter out URLs that match exclude patterns FIRST
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

	// Track excluded URLs
	if (excludedCount > 0) {
		metadataTracker.addUrlsExcluded(excludedCount);
		metadataTracker.removeFieldStatsForExcludedUrls(
			excludedCount,
			excludedItemIndices,
		);
	}

	metadataTracker.addFilteredItems(
		pageResult.filteredCount,
		pageResult.filteredReasons,
	);

	// Track field extraction warnings
	const fieldWarnings = pageResult.filteredReasons.filter(
		(reason) =>
			reason.includes("Optional field") || reason.includes("Required field"),
	);
	if (fieldWarnings.length > 0) {
		metadataTracker.addFieldExtractionWarnings(fieldWarnings);
	}

	// Filter out duplicates
	const newItems = filterDuplicates(filteredPageItems, seenUrls);
	const sessionDuplicatesSkipped = filteredPageItems.length - newItems.length;

	if (sessionDuplicatesSkipped > 0) {
		metadataTracker.addDuplicatesSkipped(sessionDuplicatesSkipped);
	}

	// Filter out urls already existing in DB
	let itemsToProcess = newItems;
	let dbDuplicatesSkipped = 0;

	if (newItems.length > 0 && options?.skipExistingUrls !== false) {
		const metadataStore = metadataTracker.getMetadataStore();
		if (metadataStore) {
			const allUrls = newItems.map((item) => item.url);
			const existingUrls = metadataStore.getExistingUrls(allUrls);

			if (existingUrls.size > 0) {
				itemsToProcess = newItems.filter((item) => !existingUrls.has(item.url));
				dbDuplicatesSkipped = newItems.length - itemsToProcess.length;
				metadataTracker.addDuplicatesSkipped(dbDuplicatesSkipped);
			}
		}
	}

	return {
		itemsToProcess,
		pageResult,
		excludedCount,
		sessionDuplicatesSkipped,
		dbDuplicatesSkipped,
		newItems,
		filteredPageItems,
	};
}

async function processContentExtraction(
	page: Page,
	itemsToProcess: CrawledData[],
	config: SourceConfig,
	options: CrawlOptions,
	metadataTracker: MetadataTracker,
	contentExtractor: ContentPageExtractor,
) {
	if (itemsToProcess.length === 0) return;

	const metadata = metadataTracker.getMetadata();
	const currentListingUrl = page.url();

	const concurrency =
		options?.contentConcurrency ??
		EXTRACTION_CONCURRENCY.HIGH_PERFORMANCE_LIMIT;
	const skipExisting = options?.skipExistingUrls ?? true;

	console.log(
		`Extracting content data for ${itemsToProcess.length} items (concurrency: ${concurrency})...`,
	);

	await contentExtractor.extractContentPagesConcurrently(
		page,
		itemsToProcess,
		config,
		metadata.itemsProcessed,
		concurrency,
		metadataTracker.getMetadataStore(),
		skipExisting,
		metadata.contentErrors,
		metadata.contentFieldStats,
		metadataTracker,
	);

	metadataTracker.addContentsCrawled(itemsToProcess.length);

	if (metadata.contentErrors.length > 0) {
		metadataTracker.addContentErrors(metadata.contentErrors);
		metadata.contentErrors.length = 0;
	}

	const contentWarnings = metadata.contentErrors.filter(
		(error) => error.includes("Optional field") || error.includes("not found"),
	);
	if (contentWarnings.length > 0) {
		metadataTracker.addFieldExtractionWarnings(contentWarnings);
	}

	await page.goto(currentListingUrl, { waitUntil: "domcontentloaded" });

	if (options?.onPageComplete) {
		const originalTracker = options.metadataTracker;
		options.metadataTracker = metadataTracker;
		await options.onPageComplete(itemsToProcess);
		options.metadataTracker = originalTracker;
	}

	metadataTracker.addItems(itemsToProcess);
	metadataTracker.checkpoint();
}

function logPageSummary(
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
) {
	const totalItemsOnPage = pageResult.items.length;
	const filteredOnPage = pageResult.filteredCount;

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

	if (runningMetadata) {
		console.log(
			`  Running totals: ${runningMetadata.itemsProcessed} processed, ${runningMetadata.duplicatesSkipped} duplicates, ${runningMetadata.totalFilteredItems} filtered`,
		);
	}
}

async function crawlListing(
	config: SourceConfig,
	options?: CrawlOptions,
): Promise<CrawlResult> {
	const startTime = new Date();
	const interruptionHandler = createInterruptionHandler();
	const listingExtractor = createListingPageExtractor();
	const contentExtractor = createContentPageExtractor();

	interruptionHandler.setup();

	if (config.type !== CRAWLER_TYPES.LISTING) {
		throw new CrawlerError(
			`Config type must be '${CRAWLER_TYPES.LISTING}' (only supported type in Phase 1)`,
			config.id,
		);
	}

	const browser = await createBrowser();

	try {
		const page = await setupPage(browser, config.listing.url);
		return await extractItemsFromListing(
			page,
			config,
			options,
			startTime,
			interruptionHandler,
			listingExtractor,
			contentExtractor,
		);
	} catch (error) {
		throw new CrawlerError(
			`Failed to crawl ${config.name}`,
			config.id,
			error instanceof Error ? error : new Error(String(error)),
		);
	} finally {
		await browser.close();
		interruptionHandler.cleanup();
	}
}

async function extractItemsFromListing(
	page: Page,
	config: SourceConfig,
	options: CrawlOptions = {},
	startTime: Date,
	interruptionHandler: InterruptionHandler,
	listingExtractor: ListingPageExtractor,
	contentExtractor: ContentPageExtractor,
): Promise<CrawlResult> {
	const metadataTracker = createMetadataTracker(config, startTime);
	const seenUrls = new Set<string>();

	while (true) {
		const metadata = metadataTracker.getMetadata();

		if (checkForInterruption(interruptionHandler, metadataTracker)) break;

		if (options.maxPages && metadata.pagesProcessed >= options.maxPages) {
			metadataTracker.setStoppedReason(StoppedReason.MAX_PAGES);
			break;
		}

		metadataTracker.incrementPagesProcessed();

		const {
			itemsToProcess,
			pageResult,
			excludedCount,
			dbDuplicatesSkipped,
			newItems,
			filteredPageItems,
		} = await processPageItems(
			page,
			config,
			options,
			metadataTracker,
			seenUrls,
			listingExtractor,
		);

		// Check if all items are duplicates
		if (
			filteredPageItems.length > 0 &&
			itemsToProcess.length === 0 &&
			options?.stopOnAllDuplicates !== false
		) {
			metadataTracker.setStoppedReason(StoppedReason.ALL_DUPLICATES);
			const totalDuplicatesOnPage =
				filteredPageItems.length - newItems.length + dbDuplicatesSkipped;

			const updatedPageResult = {
				...pageResult,
				filteredCount: pageResult.filteredCount + excludedCount,
			};

			logPageSummary(
				metadata.pagesProcessed,
				updatedPageResult,
				0,
				totalDuplicatesOnPage,
				options?.maxPages,
				metadata,
			);
			break;
		}

		const totalDuplicatesOnPage =
			filteredPageItems.length - newItems.length + dbDuplicatesSkipped;

		const updatedPageResult = {
			...pageResult,
			filteredCount: pageResult.filteredCount + excludedCount,
		};

		logPageSummary(
			metadata.pagesProcessed,
			updatedPageResult,
			itemsToProcess.length,
			totalDuplicatesOnPage,
			options?.maxPages,
			metadata,
		);

		if (itemsToProcess.length > 0) {
			await processContentExtraction(
				page,
				itemsToProcess,
				config,
				options,
				metadataTracker,
				contentExtractor,
			);
		}

		const hasNextPage = await navigateToNextPage(page, config);

		if (checkForInterruption(interruptionHandler, metadataTracker)) break;

		if (!hasNextPage) {
			metadataTracker.setStoppedReason(StoppedReason.NO_NEXT_BUTTON);
			break;
		}
	}

	return metadataTracker.buildCrawlResult();
}

export function createArticleListingCrawler(): Crawler {
	return {
		type: CRAWLER_TYPES.LISTING,
		crawl: crawlListing,
	};
}
