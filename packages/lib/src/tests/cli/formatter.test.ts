import { describe, expect, it } from "vitest";
import { formatDataForViewing } from "@/cli/ui/formatter.js";
import type { CrawlSummary, ProcessedData } from "@/index.js";

describe("Data Formatter", () => {
	const createMockSummary = (): CrawlSummary => ({
		sourceId: "test-source",
		sourceName: "Test Source",
		itemsFound: 2,
		itemsProcessed: 2,
		itemsWithErrors: 0,
		fieldStats: [],
		detailFieldStats: [],
		listingErrors: [],
		startTime: new Date("2025-01-01T10:00:00Z"),
		endTime: new Date("2025-01-01T10:00:05Z"),
	});

	const createMockData = (): ProcessedData[] => [
		{
			url: "https://example.com/article1",
			timestamp: new Date("2025-01-01T10:00:01Z"),
			source: "test-source",
			title: "First Article",
			content: "This is the first article content.",
			author: "John Doe",
			publishedDate: "2025-01-01",
			image: "https://example.com/image1.jpg",
			tags: ["tech", "news"],
			metadata: { wordCount: 100, category: "technology" },
			analysis: [],
		},
		{
			url: "https://example.com/article2",
			timestamp: new Date("2025-01-01T10:00:02Z"),
			source: "test-source",
			title: "Second Article",
			content: "This is the second article content.",
			metadata: { wordCount: 150 },
			analysis: [],
		},
	];

	it("should format header and items correctly", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		// Header
		expect(result).toContain("EXTRACTED DATA - Test Source (test-source)");
		expect(result).toContain("Items: 2");

		// Items
		expect(result).toContain("--- Item 1 of 2 ---");
		expect(result).toContain("Title: First Article");
		expect(result).toContain("URL: https://example.com/article1");
		expect(result).toContain("Tags: tech, news");
		expect(result).toContain("--- Item 2 of 2 ---");
		expect(result).toContain("Title: Second Article");
	});

	it("should handle missing optional fields and null values", () => {
		const dataWithNulls: ProcessedData[] = [
			{
				url: "",
				timestamp: new Date("2025-01-01T10:00:01Z"),
				source: "test-source",
				title: "",
				content: "",
				metadata: {},
				analysis: [],
			},
		];
		const summary = createMockSummary();

		const result = formatDataForViewing(dataWithNulls, summary);

		expect(result).toContain("Title: N/A");
		expect(result).toContain("URL: N/A");
		expect(result).toContain("Content: N/A");

		// Second item has no optional fields
		const data = createMockData();
		const result2 = formatDataForViewing(data, summary);
		const secondItemSection = result2.split("--- Item 2 of 2 ---")[1];
		expect(secondItemSection).not.toContain("Author:");
		expect(secondItemSection).not.toContain("Excerpt:");
	});

	it("should format metadata as JSON and handle edge cases", () => {
		const data = createMockData();
		const summary = createMockSummary();

		const result = formatDataForViewing(data, summary);

		expect(result).toContain("Metadata:");
		expect(result).toContain("  wordCount: 100");
		expect(result).toContain('  category: "technology"');

		// Test empty data
		const emptyResult = formatDataForViewing([], summary);
		expect(emptyResult).toContain("Items: 0");
		expect(emptyResult).toContain("End of data");

		// Test single item (no divider)
		const singleResult = formatDataForViewing([data[0]], summary);
		expect(singleResult).toContain("--- Item 1 of 1 ---");
		expect(singleResult).not.toContain("-".repeat(40));
	});
});
