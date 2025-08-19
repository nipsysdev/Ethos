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
import { CRAWLER_TYPES, CrawlerError } from "@/core/types.js";

describe("ProcessingPipeline - Basic Functionality", () => {
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

	it("should throw error when no crawler found", async () => {
		const registry = createCrawlerRegistry();
		const pipeline = createProcessingPipeline(registry, {
			storageBasePath: "./test-storage",
			contentStoreOptions: { enableMetadata: false },
		});

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
						crawledAt: new Date(),
						source: "test",
						title: "Test Article",
						content: "Test content",
						publishedDate: "2025-07-10T00:00:00.000Z", // Use proper ISO format
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
		const pipeline = createProcessingPipeline(registry, {
			storageBasePath: "./test-storage",
			contentStoreOptions: { enableMetadata: false },
		});

		const result = await pipeline.process(testConfig);

		expect(result.data).toHaveLength(1);
		expect(result.data[0].title).toBe("Test Article");
		expect(result.data[0].publishedDate).toBe("2025-07-10T00:00:00.000Z");
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

		const registry = createCrawlerRegistry();
		registry.register(failingCrawler);
		const pipeline = createProcessingPipeline(registry, {
			storageBasePath: "./test-storage",
			contentStoreOptions: { enableMetadata: false },
		});

		await expect(pipeline.process(testConfig)).rejects.toThrow(
			"Network failure",
		);
	});
});
