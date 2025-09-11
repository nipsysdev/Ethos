import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import type { FieldExtractionStats, SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor.js";

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
		content: {
			container_selector: ".article-content",
			fields: {
				content: { selector: ".content", attribute: "text" },
			},
		},
	};

	it("should extract items from page successfully", async () => {
		const extractor = createListingPageExtractor();
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
					extractionErrors: [],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
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
		const extractor = createListingPageExtractor();
		const mockPage = {
			url: () => "https://test.com",
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
					extractionErrors: [],
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
					extractionErrors: [],
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
		const extractor = createListingPageExtractor();
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

	it("should handle extraction errors and include them in filtered reasons", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Error Article" },
					fieldResults: {
						title: { success: true, value: "Error Article" },
						url: { success: false, value: null, error: "Selector not found" },
						author: { success: false, value: null, error: "Element missing" },
					},
					hasRequiredFields: false,
					missingRequiredFields: ["url"],
					extractionErrors: [
						"Field 'url' extraction failed: Selector not found",
						"Field 'author' extraction failed: Element missing",
					],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
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

		expect(result.items).toHaveLength(0);
		expect(result.filteredCount).toBe(1);
		expect(result.filteredReasons).toContain(
			"Field 'url' extraction failed: Selector not found",
		);
		expect(result.filteredReasons).toContain(
			"Field 'author' extraction failed: Element missing",
		);
	});

	it("should handle items with no extractable data", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: {},
					fieldResults: {},
					hasRequiredFields: false,
					missingRequiredFields: ["title", "url"],
					extractionErrors: [],
				},
			]),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfig,
			fieldStats,
			0,
		);

		expect(result.items).toHaveLength(0);
		expect(result.filteredCount).toBe(1);
		expect(result.filteredReasons).toContain(
			"Item contained no extractable data",
		);
	});

	it("should handle mixed success and failure cases", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Good Article", url: "/article/1" },
					fieldResults: {
						title: { success: true, value: "Good Article" },
						url: { success: true, value: "/article/1" },
						author: { success: false, value: null },
					},
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					item: { title: "Bad Article" },
					fieldResults: {
						title: { success: true, value: "Bad Article" },
						url: { success: false, value: null, error: "Network error" },
						author: { success: false, value: null },
					},
					hasRequiredFields: false,
					missingRequiredFields: ["url"],
					extractionErrors: ["Field 'url' extraction failed: Network error"],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
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
		expect(result.items[0].title).toBe("Good Article");
		expect(result.filteredCount).toBe(1);
		expect(result.filteredReasons).toContain(
			"Field 'url' extraction failed: Network error",
		);
	});

	it("should exclude items with URLs matching exclusion patterns", async () => {
		const extractor = createListingPageExtractor();
		const mockConfigWithExcludes: SourceConfig = {
			...mockConfig,
			content_url_excludes: ["/excluded/", "/category/"],
		};

		const mockPage = {
			url: () => "https://test.com",
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Normal Article", url: "/article/1" },
					fieldResults: {
						title: { success: true, value: "Normal Article" },
						url: { success: true, value: "/article/1" },
					},
					hasExcludedUrl: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					item: { title: "Excluded Article", url: "/excluded/article/2" },
					fieldResults: {
						title: { success: true, value: "Excluded Article" },
						url: { success: true, value: "/excluded/article/2" },
					},
					hasExcludedUrl: true,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					item: { title: "Another Normal Article", url: "/article/3" },
					fieldResults: {
						title: { success: true, value: "Another Normal Article" },
						url: { success: true, value: "/article/3" },
					},
					hasExcludedUrl: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfigWithExcludes,
			fieldStats,
			0,
		);

		// Should only include non-excluded items
		expect(result.items).toHaveLength(2);
		expect(result.items[0].title).toBe("Normal Article");
		expect(result.items[1].title).toBe("Another Normal Article");

		// Should track excluded URLs
		expect(result.excludedUrls).toContain("/excluded/article/2");
		expect(result.filteredCount).toBe(1);
	});

	it("should handle items with no exclusion patterns", async () => {
		const extractor = createListingPageExtractor();
		const mockConfigWithoutExcludes: SourceConfig = {
			...mockConfig,
			content_url_excludes: undefined,
		};

		const mockPage = {
			url: () => "https://test.com",
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Article 1", url: "/article/1" },
					fieldResults: {
						title: { success: true, value: "Article 1" },
						url: { success: true, value: "/article/1" },
					},
					hasExcludedUrl: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					item: { title: "Article 2", url: "/article/2" },
					fieldResults: {
						title: { success: true, value: "Article 2" },
						url: { success: true, value: "/article/2" },
					},
					hasExcludedUrl: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfigWithoutExcludes,
			fieldStats,
			0,
		);

		// Should include all items when no exclusion patterns
		expect(result.items).toHaveLength(2);
		expect(result.excludedUrls).toHaveLength(0);
		expect(result.filteredCount).toBe(0);
	});

	it("should properly filter items when exclusion patterns is empty array", async () => {
		const extractor = createListingPageExtractor();
		const mockConfigWithEmptyExcludes: SourceConfig = {
			...mockConfig,
			content_url_excludes: [],
		};

		const mockPage = {
			url: () => "https://test.com",
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Article 1", url: "/article/1" },
					fieldResults: {
						title: { success: true, value: "Article 1" },
						url: { success: true, value: "/article/1" },
					},
					hasExcludedUrl: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfigWithEmptyExcludes,
			fieldStats,
			0,
		);

		// Should include all items when exclusion patterns is empty
		expect(result.items).toHaveLength(1);
		expect(result.excludedUrls).toHaveLength(0);
		expect(result.filteredCount).toBe(0);
	});

	it("should add filtered reason for excluded items", async () => {
		const extractor = createListingPageExtractor();
		const mockConfigWithExcludes: SourceConfig = {
			...mockConfig,
			content_url_excludes: ["/excluded/"],
		};

		const mockPage = {
			url: () => "https://test.com",
			evaluate: vi.fn().mockResolvedValue([
				{
					item: { title: "Excluded Article", url: "/excluded/article/1" },
					fieldResults: {
						title: { success: true, value: "Excluded Article" },
						url: { success: true, value: "/excluded/article/1" },
					},
					hasExcludedUrl: true,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfigWithExcludes,
			fieldStats,
			0,
		);

		// Should have no valid items but should track the exclusion
		expect(result.items).toHaveLength(0);
		expect(result.excludedUrls).toContain("/excluded/article/1");
		expect(result.filteredCount).toBe(1);

		// Should not add a specific filtered reason for excluded items
		// (they are tracked separately in excludedUrls)
		expect(result.filteredReasons).toHaveLength(0);
	});
});
