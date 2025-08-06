import {
	ContentStore,
	type ContentStoreOptions,
} from "@/storage/ContentStore.js";
import type {
	CrawledData,
	CrawlerRegistry,
	CrawlOptions,
	CrawlSummary,
	ProcessedData,
	SourceConfig,
} from "./types.js";
import { CrawlerError } from "./types.js";

export interface ProcessingResult {
	data: ProcessedData[];
	summary: CrawlSummary;
}

// Lightweight version for UI that doesn't hold full content in memory
export interface ProcessingSummaryResult {
	summary: CrawlSummary;
}

export interface ProcessingPipelineOptions {
	storageBasePath?: string;
	contentStoreOptions?: ContentStoreOptions;
}

export class ProcessingPipeline {
	private contentStore: ContentStore;

	constructor(
		private crawlerRegistry: CrawlerRegistry,
		optionsOrPath: ProcessingPipelineOptions | string = {},
	) {
		// Support backward compatibility: if string is passed, treat it as storageBasePath
		const options =
			typeof optionsOrPath === "string"
				? { storageBasePath: optionsOrPath }
				: optionsOrPath;

		const { storageBasePath = "./storage", contentStoreOptions = {} } = options;

		this.contentStore = new ContentStore({
			storageDir: `${storageBasePath}/content`,
			...contentStoreOptions,
		});
	}

	async process(
		config: SourceConfig,
		options?: CrawlOptions,
	): Promise<ProcessingResult> {
		const crawler = this.crawlerRegistry.getCrawler(config.type);
		if (!crawler) {
			throw new CrawlerError(
				`No crawler found for type: ${config.type}`,
				config.id,
			);
		}

		// Storage for processed data and streaming storage results
		const processedData: ProcessedData[] = [];
		const storageResults = new Map<
			string,
			{ hash: string; path: string; storedAt: Date }
		>();

		// Add the streaming callback to options
		const streamingOptions: CrawlOptions = {
			...options,
		};

		// Create streaming storage callback with access to streamingOptions for metadataTracker
		const onPageComplete = async (items: CrawledData[]) => {
			for (const data of items) {
				try {
					const storageResult = await this.contentStore.store(data);
					storageResults.set(data.url, {
						hash: storageResult.hash,
						path: storageResult.path,
						storedAt: storageResult.storedAt,
					});

					// Link content to session if metadata tracker is available
					if (streamingOptions?.metadataTracker && storageResult.metadata?.id) {
						// Check if this item had content extraction errors
						const hadContentError = Boolean(
							data.metadata?.contentFieldsFailed &&
								Array.isArray(data.metadata.contentFieldsFailed) &&
								data.metadata.contentFieldsFailed.length > 0,
						);
						streamingOptions.metadataTracker.linkContentToSession(
							storageResult.metadata.id,
							hadContentError,
						);
					}

					// Build processed data immediately with storage info
					processedData.push({
						...data,
						analysis: [],
						storage: {
							hash: storageResult.hash,
							path: storageResult.path,
							storedAt: storageResult.storedAt,
						},
					});
				} catch (error) {
					console.warn(`Failed to store item ${data.url}:`, error);
					// Still add to processed data without storage info
					processedData.push({
						...data,
						analysis: [],
						storage: undefined,
					});
				}
			}
		};

		// Update the callback in streamingOptions
		streamingOptions.onPageComplete = onPageComplete;

		const result = await crawler.crawl(config, streamingOptions);

		// Calculate storage statistics
		const itemsStored = processedData.filter((item) => item.storage).length;
		const itemsFailed = processedData.length - itemsStored;

		// Add storage stats to summary
		const summaryWithStorage = {
			...result.summary,
			storageStats: {
				itemsStored,
				itemsFailed,
			},
		};

		// Return the processed data that was built during streaming
		return {
			data: processedData,
			summary: summaryWithStorage,
		};
	}

	/**
	 * Creates a memory-efficient summary result that doesn't hold full content
	 */
	static createSummaryResult(
		result: ProcessingResult,
	): ProcessingSummaryResult {
		return {
			summary: result.summary,
		};
	}

	/**
	 * Process and return only summary result for memory efficiency
	 */
	async processSummary(
		config: SourceConfig,
		options?: CrawlOptions,
	): Promise<ProcessingSummaryResult> {
		const fullResult = await this.process(config, options);
		return ProcessingPipeline.createSummaryResult(fullResult);
	}

	/**
	 * Get the metadata store instance for accessing session and content metadata
	 */
	getMetadataStore() {
		return this.contentStore.getMetadataStore();
	}
}
