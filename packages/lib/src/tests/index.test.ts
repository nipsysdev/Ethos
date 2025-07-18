import { describe, expect, it } from "vitest";
import {
	CrawlerRegistry,
	ProcessingPipeline,
	SourceRegistry,
} from "../index.js";

describe("Main Exports", () => {
	it("should export all core classes", () => {
		expect(CrawlerRegistry).toBeDefined();
		expect(ProcessingPipeline).toBeDefined();
		expect(SourceRegistry).toBeDefined();
	});

	it("should be able to instantiate core classes", () => {
		const crawlerRegistry = new CrawlerRegistry();
		const sourceRegistry = new SourceRegistry();

		expect(crawlerRegistry).toBeInstanceOf(CrawlerRegistry);
		expect(sourceRegistry).toBeInstanceOf(SourceRegistry);
	});
});
