import type { CrawlerRegistry, ProcessedData, SourceConfig } from "./types.js";
import { CrawlerError } from "./types.js";

export class ProcessingPipeline {
	constructor(private crawlerRegistry: CrawlerRegistry) {}

	async process(config: SourceConfig): Promise<ProcessedData[]> {
		const crawler = this.crawlerRegistry.getCrawler(config.type);
		if (!crawler) {
			throw new CrawlerError(
				`No crawler found for type: ${config.type}`,
				config.id,
			);
		}

		console.log(`Crawling source: ${config.name}`);
		const rawData = await crawler.crawl(config);
		console.log(`Crawled ${rawData.length} items from ${config.name}`);

		return rawData.map((data) => ({ ...data, analysis: [] }));
	}
}
