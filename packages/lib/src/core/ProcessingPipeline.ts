import { ContentStore } from "@/storage/ContentStore.js";
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

export class ProcessingPipeline {
	private contentStore: ContentStore;

	constructor(
		private crawlerRegistry: CrawlerRegistry,
		storageBasePath: string = "./storage",
	) {
		this.contentStore = new ContentStore({
			storageDir: `${storageBasePath}/content`,
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
						// Check if this item had detail extraction errors
						const hadDetailError = Boolean(
							data.metadata?.detailFieldsFailed &&
								Array.isArray(data.metadata.detailFieldsFailed) &&
								data.metadata.detailFieldsFailed.length > 0,
						);
						streamingOptions.metadataTracker.linkContentToSession(
							storageResult.metadata.id,
							hadDetailError,
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

		// Return the processed data that was built during streaming
		return {
			data: processedData,
			summary: result.summary,
		};
	}
}
