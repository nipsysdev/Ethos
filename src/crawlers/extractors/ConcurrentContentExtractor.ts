import type { Browser, Page } from "puppeteer";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

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

export interface ContentExtractionHandler {
	extractContentForSingleItem: (
		page: Page,
		item: CrawledData,
		config: SourceConfig,
		contentErrors: string[],
		contentFieldStats: FieldExtractionStats[],
		itemIndex: number,
	) => Promise<void>;
}

function filterOutExistingUrls(
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

async function createPagePool(
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

function getAvailablePageIndex(
	availablePages: Set<number>,
): number | undefined {
	return Array.from(availablePages)[0];
}

function logProgress(completedCount: number, totalCount: number): void {
	if (completedCount % 5 === 0 || completedCount === totalCount) {
		console.log(
			`  Content extraction progress: ${completedCount}/${totalCount} completed`,
		);
	}
}

async function cleanupPagePool(pagePool: Page[]): Promise<void> {
	for (const page of pagePool) {
		await page.close();
	}
	pagePool.length = 0;
}

async function processItemsConcurrently(
	pagePool: Page[],
	items: CrawledData[],
	config: SourceConfig,
	itemOffset: number,
	contentErrors: string[],
	contentFieldStats: FieldExtractionStats[],
	dependencies: ContentExtractionHandler,
): Promise<void> {
	const availablePages = new Set<number>();
	const runningTasks = new Map<Promise<void>, number>();
	let itemIndex = 0;
	let completedCount = 0;

	for (let i = 0; i < pagePool.length; i++) {
		availablePages.add(i);
	}

	while (itemIndex < items.length || runningTasks.size > 0) {
		while (itemIndex < items.length && availablePages.size > 0) {
			const currentIndex = itemIndex++;
			const item = items[currentIndex];
			const pageIndex = getAvailablePageIndex(availablePages);

			if (pageIndex === undefined) {
				throw new Error(
					"No available page index found for content extraction.",
				);
			}

			availablePages.delete(pageIndex);

			const task = dependencies.extractContentForSingleItem(
				pagePool[pageIndex],
				item,
				config,
				contentErrors,
				contentFieldStats,
				itemOffset + currentIndex,
			);

			runningTasks.set(task, pageIndex);

			task.finally(() => {
				const freedPageIndex = runningTasks.get(task);
				runningTasks.delete(task);
				if (freedPageIndex !== undefined) {
					availablePages.add(freedPageIndex);
				}

				completedCount++;
				logProgress(completedCount, items.length);
			});
		}

		if (runningTasks.size > 0) {
			await Promise.race([...runningTasks.keys()]);
		}
	}

	runningTasks.clear();
	availablePages.clear();
}

export function createConcurrentContentExtractor(
	dependencies: ContentExtractionHandler,
) {
	return {
		extractConcurrently: async (
			mainPage: Page,
			items: CrawledData[],
			config: SourceConfig,
			itemOffset: number,
			extractConfig: ConcurrentExtractionConfig,
		): Promise<void> => {
			const {
				concurrencyLimit,
				skipExistingUrls,
				metadataStore,
				externalContentErrors,
				externalContentFieldStats,
				metadataTracker,
			} = extractConfig;

			const itemsToProcess = filterOutExistingUrls(
				items,
				metadataStore,
				skipExistingUrls,
				metadataTracker,
			);

			if (itemsToProcess.length === 0) {
				console.log("All URLs filtered out, skipping content extraction");
				return;
			}

			const contentErrors: string[] = externalContentErrors || [];
			const contentFieldStats: FieldExtractionStats[] =
				externalContentFieldStats || [];

			const browser = mainPage.browser();
			const pagePool = await createPagePool(
				browser,
				concurrencyLimit,
				itemsToProcess.length,
			);

			try {
				await processItemsConcurrently(
					pagePool,
					itemsToProcess,
					config,
					itemOffset,
					contentErrors,
					contentFieldStats,
					dependencies,
				);
			} finally {
				await cleanupPagePool(pagePool);
			}
		},
	};
}
