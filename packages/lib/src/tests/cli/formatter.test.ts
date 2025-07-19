import { describe, expect, it } from "vitest";
import { formatDataForViewing } from "../../cli/ui/formatter.js";
import type { CrawledData, CrawlSummary } from "../../index.js";

describe("Data Formatter", () => {
	const createMockSummary = (): CrawlSummary => ({
		sourceId: "test-source",
		sourceName: "Test Source",
		itemsFound: 2,
		itemsProcessed: 2,
		itemsWithErrors: 0,
		fieldStats: [],
		errors: [],
		startTime: new Date("2025-01-01T10:00:00Z"),
		endTime: new Date("2025-01-01T10:00:05Z"),
	});

	const createMockData = (): CrawledData[] => [
		{
			url: "https://example.com/article1",
			timestamp: new Date("2025-01-01T10:00:01Z"),
			source: "test-source",
			title: "First Article",
			content: "This is the first article content.",
			excerpt: "First article excerpt",
			author: "John Doe",
			publishedDate: "2025-01-01",
			image: "https://example.com/image1.jpg",
			tags: ["tech", "news"],
			metadata: {
				wordCount: 100,
				category: "technology",
			},
		},
		{
			url: "https://example.com/article2",
			timestamp: new Date("2025-01-01T10:00:02Z"),
			source: "test-source",
			title: "Second Article",
			content: "This is the second article content.",
			metadata: {
				wordCount: 150,
			},
		},
	];

	it("should format header correctly", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("=".repeat(80));
		expect(result).toContain("EXTRACTED DATA - Test Source (test-source)");
		expect(result).toContain("Items: 2");
		expect(result).toContain("Crawled: 2025-01-01, 5:00:05 a.m.");
	});

	it("should format individual items correctly", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		// Check first item
		expect(result).toContain("--- Item 1 of 2 ---");
		expect(result).toContain("Title: First Article");
		expect(result).toContain("URL: https://example.com/article1");
		expect(result).toContain("Source: test-source");
		expect(result).toContain("Published: 2025-01-01");
		expect(result).toContain("Author: John Doe");
		expect(result).toContain("Excerpt: First article excerpt");
		expect(result).toContain("Image: https://example.com/image1.jpg");
		expect(result).toContain("Content: This is the first article content.");
		expect(result).toContain("Tags: tech, news");

		// Check second item
		expect(result).toContain("--- Item 2 of 2 ---");
		expect(result).toContain("Title: Second Article");
		expect(result).toContain("URL: https://example.com/article2");
	});

	it("should handle missing optional fields gracefully", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		// Second item has no author, excerpt, publishedDate, image, or tags
		const secondItemSection = result.split("--- Item 2 of 2 ---")[1];
		expect(secondItemSection).not.toContain("Author:");
		expect(secondItemSection).not.toContain("Excerpt:");
		expect(secondItemSection).not.toContain("Image:");
		expect(secondItemSection).not.toContain("Tags:");
		expect(secondItemSection).toContain("Crawled:"); // Falls back to timestamp
	});

	it("should handle null/undefined values with N/A", () => {
		const dataWithNulls: CrawledData[] = [
			{
				url: "",
				timestamp: new Date("2025-01-01T10:00:01Z"),
				source: "test-source",
				title: "",
				content: "",
				metadata: {},
			},
		];
		const summary = createMockSummary();

		const result = formatDataForViewing(dataWithNulls, summary);

		expect(result).toContain("Title: N/A");
		expect(result).toContain("URL: N/A");
		expect(result).toContain("Content: N/A");
	});

	it("should format metadata as JSON", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("Metadata:");
		expect(result).toContain("  wordCount: 100");
		expect(result).toContain('  category: "technology"');
	});

	it("should separate items with dividers", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("-".repeat(40));
	});

	it("should not add divider after last item", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		const lines = result.split("\n");
		const lastDividerIndex = lines.lastIndexOf("-".repeat(40));
		const endOfDataIndex = lines.findIndex((line: string) =>
			line.includes("End of data"),
		);

		// Divider should not be right before "End of data"
		expect(lastDividerIndex).toBeLessThan(endOfDataIndex - 5);
	});

	it("should add footer", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("End of data");
		expect(result.endsWith("=".repeat(80))).toBe(true);
	});

	it("should handle empty data array", () => {
		const data: CrawledData[] = [];
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("Items: 0");
		expect(result).toContain("End of data");
		expect(result).not.toContain("--- Item");
	});

	it("should handle single item", () => {
		const data = [createMockData()[0]];
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("--- Item 1 of 1 ---");
		expect(result).not.toContain("-".repeat(40)); // No divider for single item
	});

	it("should handle empty tags array", () => {
		const dataWithEmptyTags: CrawledData[] = [
			{
				...createMockData()[0],
				tags: [],
			},
		];
		const summary = createMockSummary();

		const result = formatDataForViewing(dataWithEmptyTags, summary);

		expect(result).not.toContain("Tags:");
	});
});
