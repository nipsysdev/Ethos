import { describe, expect, it } from "vitest";
import {
	CrawlerRegistry,
	ProcessingPipeline,
	SourceRegistry,
} from "../index.js";

describe("Main Exports", () => {
	it("should export and instantiate core classes", () => {
		expect(CrawlerRegistry).toBeDefined();
		expect(ProcessingPipeline).toBeDefined();
		expect(SourceRegistry).toBeDefined();

		const crawlerRegistry = new CrawlerRegistry();
		const sourceRegistry = new SourceRegistry();

		expect(crawlerRegistry).toBeInstanceOf(CrawlerRegistry);
		expect(sourceRegistry).toBeInstanceOf(SourceRegistry);
	});
});
