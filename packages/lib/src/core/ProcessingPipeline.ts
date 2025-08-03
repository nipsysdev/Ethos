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

		// Create streaming storage callback
		const onPageComplete = async (items: CrawledData[]) => {
			for (const data of items) {
				try {
					const storageResult = await this.contentStore.store(data);
					storageResults.set(data.url, {
						hash: storageResult.hash,
						path: storageResult.path,
						storedAt: storageResult.storedAt,
					});
				} catch (error) {
					console.warn(`Failed to store item ${data.url}:`, error);
				}
			}
		};

		// Add the streaming callback to options
		const streamingOptions: CrawlOptions = {
			...options,
			onPageComplete,
		};

		const result = await crawler.crawl(config, streamingOptions);

		// Build processed data with storage info from streaming results
		for (const data of result.data) {
			const storage = storageResults.get(data.url);

			processedData.push({
				...data,
				analysis: [],
				storage: storage
					? {
							hash: storage.hash,
							path: storage.path,
							storedAt: storage.storedAt,
						}
					: undefined,
			});
		}

		return {
			data: processedData,
			summary: result.summary,
		};
	}
}
