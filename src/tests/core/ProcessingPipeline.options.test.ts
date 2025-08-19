import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCrawlerRegistry } from "@/core/CrawlerRegistry.js";
import { createProcessingPipeline } from "@/core/ProcessingPipeline.js";
import type {
	Crawler,
	CrawlOptions,
	CrawlResult,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";

describe("ProcessingPipeline - Options and Configuration", () => {
	beforeEach(async () => {
		// Ensure clean state by removing directory if it exists
		try {
			await rm("./test-storage", { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
	});

	afterEach(async () => {
		// Clean up test storage directory
		try {
			await rm("./test-storage", { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
	});

	const testConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: CRAWLER_TYPES.LISTING,
		listing: {
			url: "https://example.com",
			items: {
				container_selector: "article",
				fields: {
					title: { selector: "h1", attribute: "text" },
				},
			},
		},
		content: {
			container_selector: ".article-content",
			fields: {
				content: { selector: ".content", attribute: "text" },
			},
		},
	};

	it("should pass CrawlOptions to crawler", async () => {
		let receivedOptions: CrawlOptions | undefined;

		const mockCrawler: Crawler = {
			type: CRAWLER_TYPES.LISTING,
			async crawl(
				config: SourceConfig,
				options?: CrawlOptions,
			): Promise<CrawlResult> {
				receivedOptions = options;
				return {
					data: [],
					summary: {
						sourceId: config.id,
						sourceName: config.name,
						itemsFound: 0,
						itemsProcessed: 0,
						itemsWithErrors: 0,
						fieldStats: [],
						contentFieldStats: [],
						listingErrors: [],
						startTime: new Date(),
						endTime: new Date(),
					},
				};
			},
		};

		const registry = createCrawlerRegistry();
		registry.register(mockCrawler);
		const pipeline = createProcessingPipeline(
			registry,
			"./test-storage",
			false,
		);

		const options: CrawlOptions = { maxPages: 5 };
		await pipeline.process(testConfig, options);

		expect(receivedOptions).toEqual({
			...options,
			onPageComplete: expect.any(Function),
		});
	});

	it("should pass contentConcurrency option to crawler", async () => {
		let receivedOptions: CrawlOptions | undefined;

		const mockCrawler: Crawler = {
			type: CRAWLER_TYPES.LISTING,
			async crawl(
				config: SourceConfig,
				options?: CrawlOptions,
			): Promise<CrawlResult> {
				receivedOptions = options;
				return {
					data: [],
					summary: {
						sourceId: config.id,
						sourceName: config.name,
						itemsFound: 0,
						itemsProcessed: 0,
						itemsWithErrors: 0,
						fieldStats: [],
						contentFieldStats: [],
						listingErrors: [],
						startTime: new Date(),
						endTime: new Date(),
						contentsCrawled: 0,
					},
				};
			},
		};

		const registry = createCrawlerRegistry();
		registry.register(mockCrawler);
		const pipeline = createProcessingPipeline(
			registry,
			"./test-storage",
			false,
		);

		const options: CrawlOptions = { maxPages: 3, contentConcurrency: 10 };
		const result = await pipeline.process(testConfig, options);

		expect(receivedOptions).toEqual({
			...options,
			onPageComplete: expect.any(Function),
		});
		expect(receivedOptions?.contentConcurrency).toBe(10);
		expect(result.summary.contentsCrawled).toBe(0);
	});
});
