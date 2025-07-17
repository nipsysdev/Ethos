import { describe, expect, it } from "vitest";
import { CrawlerRegistry } from "../core/CrawlerRegistry.js";
import type { Crawler, SourceConfig } from "../core/types.js";

describe("CrawlerRegistry", () => {
	it("should register and retrieve crawlers", () => {
		const registry = new CrawlerRegistry();
		const mockCrawler: Crawler = {
			type: "test-crawler",
			crawl: async (_config: SourceConfig) => [
				{
					url: "test",
					timestamp: new Date(),
					source: "test",
					title: "test",
					content: "test",
					metadata: {},
				},
			],
		};

		registry.register(mockCrawler);

		expect(registry.getCrawler("test-crawler")).toBe(mockCrawler);
		expect(registry.getSupportedTypes()).toContain("test-crawler");
	});

	it("should return undefined for unknown crawler types", () => {
		const registry = new CrawlerRegistry();

		expect(registry.getCrawler("unknown-type")).toBeUndefined();
	});

	it("should return empty array for supported types when no crawlers registered", () => {
		const registry = new CrawlerRegistry();

		expect(registry.getSupportedTypes()).toEqual([]);
	});
});
