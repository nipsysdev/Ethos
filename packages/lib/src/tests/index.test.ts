import { describe, expect, it } from "vitest";
import {
	CrawlerRegistry,
	KeywordExtractor,
	ProcessingPipeline,
	SourceRegistry,
	StrategyRegistry,
} from "../index.js";

describe("Main Exports", () => {
	it("should export all core classes", () => {
		expect(CrawlerRegistry).toBeDefined();
		expect(ProcessingPipeline).toBeDefined();
		expect(SourceRegistry).toBeDefined();
		expect(StrategyRegistry).toBeDefined();
	});

	it("should export strategy implementations", () => {
		expect(KeywordExtractor).toBeDefined();
	});

	it("should be able to instantiate core classes", () => {
		const crawlerRegistry = new CrawlerRegistry();
		const sourceRegistry = new SourceRegistry();
		const strategyRegistry = new StrategyRegistry();

		expect(crawlerRegistry).toBeInstanceOf(CrawlerRegistry);
		expect(sourceRegistry).toBeInstanceOf(SourceRegistry);
		expect(strategyRegistry).toBeInstanceOf(StrategyRegistry);
	});
});
