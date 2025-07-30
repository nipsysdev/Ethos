import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import type { FieldExtractionStats, SourceConfig } from "../../core/types.js";
import { CRAWLER_TYPES } from "../../core/types.js";
import { ListingPageExtractor } from "../../crawlers/extractors/ListingPageExtractor.js";

describe("ListingPageExtractor", () => {
	const mockConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: CRAWLER_TYPES.LISTING,
		listing: {
			url: "https://example.com",
			items: {
				container_selector: ".article",
				fields: {
					title: { selector: ".title", attribute: "text" },
					url: { selector: "a", attribute: "href" },
					author: { selector: ".author", attribute: "text", optional: true },
				},
			},
		},
	};

	it("should extract items from page successfully", async () => {
		const extractor = new ListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: {
						title: "Test Article",
						url: "/article/1",
						author: "John Doe",
					},
					fieldResults: {
						title: { success: true, value: "Test Article" },
						url: { success: true, value: "/article/1" },
						author: { success: true, value: "John Doe" },
					},
					hasRequiredFields: true,
					missingRequiredFields: [],
				},
			]),
		} as unknown as Page;

		const fieldStats = [
			{
				fieldName: "title",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "url",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "author",
				successCount: 0,
				totalAttempts: 0,
				isOptional: true,
				missingItems: [],
			},
		];

		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfig,
			fieldStats,
			0,
		);

		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Test Article");
		expect(result.items[0].url).toBe("/article/1");
		expect(result.items[0].author).toBe("John Doe");
		expect(result.filteredCount).toBe(0);

		// Verify field stats were updated
		expect(fieldStats[0].successCount).toBe(1);
		expect(fieldStats[0].totalAttempts).toBe(1);
	});

	it("should filter items missing required fields", async () => {
		const extractor = new ListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Complete Article", url: "/article/1" },
					fieldResults: {
						title: { success: true, value: "Complete Article" },
						url: { success: true, value: "/article/1" },
						author: { success: false, value: null },
					},
					hasRequiredFields: true,
					missingRequiredFields: [],
				},
				{
					item: { title: "Incomplete Article" },
					fieldResults: {
						title: { success: true, value: "Incomplete Article" },
						url: { success: false, value: null },
						author: { success: false, value: null },
					},
					hasRequiredFields: false,
					missingRequiredFields: ["url"],
				},
			]),
		} as unknown as Page;

		const fieldStats = [
			{
				fieldName: "title",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "url",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
		];

		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfig,
			fieldStats,
			0,
		);

		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Complete Article");
		expect(result.filteredCount).toBe(1);

		// Check that missing items are tracked
		expect(fieldStats[1].missingItems).toContain(2); // Second item failed
	});

	it("should handle empty results gracefully", async () => {
		const extractor = new ListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([]),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfig,
			fieldStats,
			0,
		);

		expect(result.items).toHaveLength(0);
		expect(result.filteredCount).toBe(0);
		expect(result.filteredReasons).toHaveLength(0);
	});
});
