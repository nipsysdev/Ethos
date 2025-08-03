import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { CrawlerRegistry } from "../core/CrawlerRegistry.js";
import { ProcessingPipeline } from "../core/ProcessingPipeline.js";
import type {
	Crawler,
	CrawlOptions,
	CrawlResult,
	SourceConfig,
} from "../core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "../core/types.js";

describe("ProcessingPipeline", () => {
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
	};

	it("should throw error when no crawler found", async () => {
		const registry = new CrawlerRegistry();
		const pipeline = new ProcessingPipeline(registry, "./test-storage");

		await expect(pipeline.process(testConfig)).rejects.toThrow(CrawlerError);
		await expect(pipeline.process(testConfig)).rejects.toThrow(
			`No crawler found for type: ${CRAWLER_TYPES.LISTING}`,
		);
	});

	it("should process successful crawl results", async () => {
		const mockCrawler: Crawler = {
			type: CRAWLER_TYPES.LISTING,
			async crawl(
				_config: SourceConfig,
				options?: CrawlOptions,
			): Promise<CrawlResult> {
				const data = [
					{
						url: "https://example.com/1",
						timestamp: new Date(),
						source: "test",
						title: "Test Article",
						content: "Test content",
						metadata: {},
					},
				];

				// Simulate the onPageComplete callback like a real crawler would
				if (options?.onPageComplete) {
					await options.onPageComplete(data);
				}

				return {
					data,
					summary: {
						sourceId: "test",
						sourceName: "Test Source",
						itemsFound: 1,
						itemsProcessed: 1,
						itemsWithErrors: 0,
						fieldStats: [],
						listingErrors: [],
						startTime: new Date(),
						endTime: new Date(),
					},
				};
			},
		};

		const registry = new CrawlerRegistry();
		registry.register(mockCrawler);
		const pipeline = new ProcessingPipeline(registry, "./test-storage");

		const result = await pipeline.process(testConfig);

		expect(result.data).toHaveLength(1);
		expect(result.data[0].title).toBe("Test Article");
		expect(result.data[0].analysis).toEqual([]);
		expect(result.data[0].storage).toBeDefined();
		expect(result.data[0].storage?.hash).toMatch(/^[a-f0-9]{40}$/); // SHA-1 hash
		expect(result.data[0].storage?.path).toContain(".json");
		expect(result.data[0].storage?.storedAt).toBeInstanceOf(Date);
		expect(result.summary.itemsProcessed).toBe(1);
	});

	it("should handle crawler errors", async () => {
		const failingCrawler: Crawler = {
			type: CRAWLER_TYPES.LISTING,
			async crawl(): Promise<CrawlResult> {
				throw new Error("Network failure");
			},
		};

		const registry = new CrawlerRegistry();
		registry.register(failingCrawler);
		const pipeline = new ProcessingPipeline(registry, "./test-storage");

		await expect(pipeline.process(testConfig)).rejects.toThrow(
			"Network failure",
		);
	});

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
						listingErrors: [],
						startTime: new Date(),
						endTime: new Date(),
					},
				};
			},
		};

		const registry = new CrawlerRegistry();
		registry.register(mockCrawler);
		const pipeline = new ProcessingPipeline(registry, "./test-storage");

		const options: CrawlOptions = { maxPages: 5 };
		await pipeline.process(testConfig, options);

		expect(receivedOptions).toEqual({
			...options,
			onPageComplete: expect.any(Function),
		});
	});

	it("should pass skipDetails option to crawler", async () => {
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
						listingErrors: [],
						startTime: new Date(),
						endTime: new Date(),
						detailsSkipped: options?.skipDetails ? 0 : undefined,
					},
				};
			},
		};

		const registry = new CrawlerRegistry();
		registry.register(mockCrawler);
		const pipeline = new ProcessingPipeline(registry, "./test-storage");

		const options: CrawlOptions = { maxPages: 3, skipDetails: true };
		const result = await pipeline.process(testConfig, options);

		expect(receivedOptions).toEqual({
			...options,
			onPageComplete: expect.any(Function),
		});
		expect(receivedOptions?.skipDetails).toBe(true);
		expect(result.summary.detailsSkipped).toBe(0);
	});
});
