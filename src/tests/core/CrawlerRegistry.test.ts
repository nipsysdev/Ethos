import { describe, expect, it } from "vitest";
import { createCrawlerRegistry } from "@/core/CrawlerRegistry.js";
import type { Crawler, CrawlResult, SourceConfig } from "@/core/types.js";

describe("CrawlerRegistry", () => {
	it("should register and retrieve crawlers", () => {
		const registry = createCrawlerRegistry();
		const mockCrawler: Crawler = {
			type: "test-crawler",
			crawl: async (_config: SourceConfig): Promise<CrawlResult> => ({
				data: [
					{
						url: "test",
						crawledAt: new Date(),
						source: "test",
						title: "test",
						content: "test",
						metadata: {},
					},
				],
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
			}),
		};

		registry.register(mockCrawler);

		expect(registry.getCrawler("test-crawler")).toBe(mockCrawler);
		expect(registry.getSupportedTypes()).toContain("test-crawler");
	});

	it("should return undefined for unknown crawler types", () => {
		const registry = createCrawlerRegistry();

		expect(registry.getCrawler("unknown-type")).toBeUndefined();
	});

	it("should return empty array for supported types when no crawlers registered", () => {
		const registry = createCrawlerRegistry();

		expect(registry.getSupportedTypes()).toEqual([]);
	});
});
