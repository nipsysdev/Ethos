import { describe, expect, it } from "vitest";
import { CrawlerRegistry } from "../core/CrawlerRegistry.js";
import { ProcessingPipeline } from "../core/ProcessingPipeline.js";
import type { CrawledData, Crawler, SourceConfig } from "../core/types.js";
import { CrawlerError } from "../core/types.js";

describe("ProcessingPipeline", () => {
	const testConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: "listing",
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
		const pipeline = new ProcessingPipeline(registry);

		await expect(pipeline.process(testConfig)).rejects.toThrow(CrawlerError);
		await expect(pipeline.process(testConfig)).rejects.toThrow(
			"No crawler found for type: listing",
		);
	});

	it("should process successful crawl results", async () => {
		const mockCrawler: Crawler = {
			type: "listing",
			async crawl(): Promise<CrawledData[]> {
				return [
					{
						url: "https://example.com/1",
						timestamp: new Date(),
						source: "test",
						title: "Test Article",
						content: "Test content",
						metadata: {},
					},
				];
			},
		};

		const registry = new CrawlerRegistry();
		registry.register(mockCrawler);
		const pipeline = new ProcessingPipeline(registry);

		const results = await pipeline.process(testConfig);

		expect(results).toHaveLength(1);
		expect(results[0].title).toBe("Test Article");
		expect(results[0].analysis).toEqual([]);
	});

	it("should handle crawler errors", async () => {
		const failingCrawler: Crawler = {
			type: "listing",
			async crawl(): Promise<CrawledData[]> {
				throw new Error("Network failure");
			},
		};

		const registry = new CrawlerRegistry();
		registry.register(failingCrawler);
		const pipeline = new ProcessingPipeline(registry);

		await expect(pipeline.process(testConfig)).rejects.toThrow(
			"Network failure",
		);
	});
});
