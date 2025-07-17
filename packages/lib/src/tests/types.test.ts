import { describe, expect, it } from "vitest";
import type { AnalysisResult, CrawledData } from "../core/types.js";

describe("Type Definitions", () => {
	it("should create valid CrawledData objects", () => {
		const data: CrawledData = {
			url: "https://example.com",
			timestamp: new Date(),
			source: "test-source",
			title: "Test Article",
			content: "This is test content",
			metadata: { foo: "bar" },
		};

		expect(data.url).toBe("https://example.com");
		expect(data.title).toBe("Test Article");
		expect(data.metadata.foo).toBe("bar");
	});

	it("should create valid AnalysisResult objects", () => {
		const result: AnalysisResult = {
			topics: ["technology", "ai"],
			sentiment: 0.8,
			relevance: 0.9,
			keywords: ["test", "example"],
			confidence: 0.95,
			metadata: { analyzer: "test" },
		};

		expect(result.topics).toEqual(["technology", "ai"]);
		expect(result.sentiment).toBe(0.8);
		expect(result.keywords).toContain("test");
	});

	it("should handle optional fields in CrawledData", () => {
		const data: CrawledData = {
			url: "https://example.com",
			timestamp: new Date(),
			source: "test-source",
			title: "Test Article",
			content: "This is test content",
			excerpt: "Short excerpt",
			author: "Test Author",
			tags: ["tag1", "tag2"],
			metadata: {},
		};

		expect(data.excerpt).toBe("Short excerpt");
		expect(data.author).toBe("Test Author");
		expect(data.tags).toEqual(["tag1", "tag2"]);
	});
});
