import type {
	CrawledData,
	CrawlerRegistry,
	ProcessedData,
	SourceConfig,
	StrategyRegistry,
} from "./types.js";
import { CrawlerError } from "./types.js";

export class ProcessingPipeline {
	constructor(
		private crawlerRegistry: CrawlerRegistry,
		private strategyRegistry: StrategyRegistry,
	) {}

	async process(config: SourceConfig): Promise<ProcessedData[]> {
		try {
			// Get the appropriate crawler
			const crawler = this.crawlerRegistry.getCrawler(config.type);
			if (!crawler) {
				throw new CrawlerError(
					`No crawler found for type: ${config.type}`,
					config.id,
				);
			}

			// Crawl the source
			console.log(`Crawling source: ${config.name}`);
			const rawData = await crawler.crawl(config);
			console.log(`Crawled ${rawData.length} items from ${config.name}`);

			// Process each item
			const results: ProcessedData[] = [];
			for (const data of rawData) {
				const processedData = await this.processItem(data, config);
				results.push(processedData);
			}

			return results;
		} catch (error) {
			if (error instanceof CrawlerError) {
				throw error;
			}
			throw new CrawlerError(
				`Failed to process source: ${config.name}`,
				config.id,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	private async processItem(
		data: CrawledData,
		config: SourceConfig,
	): Promise<ProcessedData> {
		const analysis = [];

		// Apply each processing strategy
		for (const strategyId of config.processingStrategies) {
			try {
				const strategy = this.strategyRegistry.getStrategy(strategyId);
				if (!strategy) {
					console.warn(`Strategy not found: ${strategyId}, skipping...`);
					continue;
				}

				const result = await strategy.process(data);
				analysis.push(result);
			} catch (error) {
				console.error(`Strategy ${strategyId} failed:`, error);
				// Continue with other strategies instead of failing completely
			}
		}

		return {
			...data,
			analysis,
		};
	}
}
