import type {
	CrawledData,
	CrawlerRegistry,
	CrawlOptions,
	CrawlSummary,
	ProcessedData,
	SourceConfig,
} from "@/core/types";
import { CrawlerError } from "@/core/types";
import type { MetadataStore } from "@/storage";
import {
	type ContentStore,
	type ContentStoreOptions,
	createContentStore as createContentStoreFromModule,
} from "@/storage/ContentStore.js";

export interface ProcessingResult {
	data: ProcessedData[];
	summary: CrawlSummary;
}

export interface ProcessingSummaryResult {
	summary: CrawlSummary;
}

export interface ProcessingPipelineOptions {
	storageBasePath?: string;
	contentStoreOptions?: ContentStoreOptions;
}

export interface ProcessingPipeline {
	process: (
		config: SourceConfig,
		options?: CrawlOptions,
	) => Promise<ProcessingResult>;
	processSummary: (
		config: SourceConfig,
		options?: CrawlOptions,
	) => Promise<ProcessingSummaryResult>;
	getMetadataStore: () => MetadataStore | undefined;
	getContentStore: () => ContentStore;
}

function createContentStore(
	optionsOrPath: ProcessingPipelineOptions | string = {},
): ContentStore {
	// Support backward compatibility: if string is passed, treat it as storageBasePath
	const options =
		typeof optionsOrPath === "string"
			? { storageBasePath: optionsOrPath }
			: optionsOrPath;

	const { storageBasePath = "./storage", contentStoreOptions = {} } = options;

	return createContentStoreFromModule({
		storageDir: `${storageBasePath}/content`,
		...contentStoreOptions,
	});
}

async function handleItemStorage(
	data: CrawledData,
	contentStore: ContentStore,
	metadataTracker?: any,
): Promise<ProcessedData> {
	try {
		const storageResult = await contentStore.store(data);

		// Link content to session if metadata tracker is available
		if (metadataTracker && storageResult.metadata?.id) {
			// Check if this item had content extraction errors
			const hadContentError = Boolean(
				data.metadata?.contentFieldsFailed &&
					Array.isArray(data.metadata.contentFieldsFailed) &&
					data.metadata.contentFieldsFailed.length > 0,
			);
			metadataTracker.linkContentToSession(
				storageResult.metadata.id,
				hadContentError,
			);
		}

		return {
			...data,
			analysis: [],
			storage: {
				hash: storageResult.hash,
				path: storageResult.path,
				storedAt: storageResult.storedAt,
			},
		};
	} catch (error) {
		console.warn(`Failed to store item ${data.url}:`, error);
		return {
			...data,
			analysis: [],
			storage: undefined,
		};
	}
}

async function processPageItems(
	items: CrawledData[],
	contentStore: ContentStore,
	metadataTracker?: any,
): Promise<ProcessedData[]> {
	const processedData: ProcessedData[] = [];

	for (const data of items) {
		const processedItem = await handleItemStorage(
			data,
			contentStore,
			metadataTracker,
		);
		processedData.push(processedItem);
	}

	return processedData;
}

function createStorageSummary(
	processedData: ProcessedData[],
): CrawlSummary["storageStats"] {
	const itemsStored = processedData.filter((item) => item.storage).length;
	const itemsFailed = processedData.length - itemsStored;

	return {
		itemsStored,
		itemsFailed,
	};
}

export function createProcessingPipeline(
	crawlerRegistry: CrawlerRegistry,
	optionsOrPath: ProcessingPipelineOptions | string = {},
): ProcessingPipeline {
	const contentStore = createContentStore(optionsOrPath);

	async function process(
		config: SourceConfig,
		options?: CrawlOptions,
	): Promise<ProcessingResult> {
		const crawler = crawlerRegistry.getCrawler(config.type);
		if (!crawler) {
			throw new CrawlerError(
				`No crawler found for type: ${config.type}`,
				config.id,
			);
		}

		const processedData: ProcessedData[] = [];

		const streamingOptions: CrawlOptions = {
			...options,
		};

		// Create streaming storage callback with access to streamingOptions for metadataTracker
		const onPageComplete = async (items: CrawledData[]) => {
			const pageProcessedData = await processPageItems(
				items,
				contentStore,
				streamingOptions?.metadataTracker,
			);
			processedData.push(...pageProcessedData);
		};

		streamingOptions.onPageComplete = onPageComplete;

		const result = await crawler.crawl(config, streamingOptions);

		const storageStats = createStorageSummary(processedData);

		const summaryWithStorage = {
			...result.summary,
			storageStats,
		};

		return {
			data: processedData,
			summary: summaryWithStorage,
		};
	}

	function createSummaryResult(
		result: ProcessingResult,
	): ProcessingSummaryResult {
		return {
			summary: result.summary,
		};
	}

	async function processSummary(
		config: SourceConfig,
		options?: CrawlOptions,
	): Promise<ProcessingSummaryResult> {
		const fullResult = await process(config, options);
		return createSummaryResult(fullResult);
	}

	function getMetadataStore() {
		return contentStore.getMetadataStore();
	}

	function getContentStore() {
		return contentStore;
	}

	return {
		process,
		processSummary,
		getMetadataStore,
		getContentStore,
	};
}
