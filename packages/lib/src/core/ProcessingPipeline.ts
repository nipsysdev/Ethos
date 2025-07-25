import type {
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
	constructor(private crawlerRegistry: CrawlerRegistry) {}

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

		const result = await crawler.crawl(config, options);

		const processedData = result.data.map((data) => ({
			...data,
			analysis: [],
		}));

		return {
			data: processedData,
			summary: result.summary,
		};
	}
}
