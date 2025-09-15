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
			container_selector: ".article",
			fields: {
				title: { selector: ".title", attribute: "text" },
				url: { selector: "a", attribute: "href" },
				author: { selector: ".author", attribute: "text", optional: true },
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

		// Mock page with required methods
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "Test Article",
						url: "/article/1",
						author: "John Doe",
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Test Article" },
						url: { success: true, value: "/article/1" },
						author: { success: true, value: "John Doe" },
					},
					isExcluded: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [
			{
				fieldName: "title" as const,
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "url" as const,
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "author" as const,
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

		// Mock page with required methods
		const mockPage = {
			url: () => "https://test.com",
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "Complete Article",
						url: "/article/1",
						author: null,
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Complete Article" },
						url: { success: true, value: "/article/1" },
						author: { success: false, value: null },
					},
					isExcluded: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					values: {
						title: "Incomplete Article",
						url: null,
						author: null,
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Incomplete Article" },
						url: { success: false, value: null },
						author: { success: false, value: null },
					},
					isExcluded: false,
					hasRequiredFields: false,
					missingRequiredFields: ["url"],
					extractionErrors: [],
				},
			]),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
		} as unknown as Page;

		const fieldStats = [
			{
				fieldName: "title" as const,
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "url" as const,
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

		// Mock page with required methods
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([]),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
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

		// Mock page with required methods
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "Error Article",
						url: null,
						author: null,
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Error Article" },
						url: { success: false, value: null, error: "Selector not found" },
						author: { success: false, value: null, error: "Element missing" },
					},
					isExcluded: false,
					hasRequiredFields: false,
					missingRequiredFields: ["url"],
					extractionErrors: [
						"Field 'url' extraction failed: Selector not found",
						"Field 'author' extraction failed: Element missing",
					],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
		} as unknown as Page;

		const fieldStats = [
			{
				fieldName: "title" as const,
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "url" as const,
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

		// Mock page with required methods
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {},
					fieldResults: {},
					isExcluded: false,
					hasRequiredFields: false,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
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

		// Mock page with required methods
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "Good Article",
						url: "/article/1",
						author: null,
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Good Article" },
						url: { success: true, value: "/article/1" },
						author: { success: false, value: null },
					},
					isExcluded: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					values: { title: "Bad Article", url: null, author: null, date: null },
					fieldResults: {
						title: { success: true, value: "Bad Article" },
						url: { success: false, value: null, error: "Network error" },
						author: { success: false, value: null },
					},
					isExcluded: false,
					hasRequiredFields: false,
					missingRequiredFields: ["url"],
					extractionErrors: ["Field 'url' extraction failed: Network error"],
				},
			]),
			url: vi.fn().mockReturnValue("https://example.com"),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [
			{
				fieldName: "title" as const,
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "url" as const,
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

	it("should handle items that are excluded by shouldExcludeItem function", async () => {
		const extractor = createListingPageExtractor();

		// Mock config with shouldExcludeItem function
		const mockConfigWithExclude: SourceConfig = {
			...mockConfig,
			listing: {
				...mockConfig.listing,
				shouldExcludeItem: vi.fn().mockImplementation((html, values) => {
					return values?.title === "Excluded Article";
				}),
			},
		};

		// Mock page with required methods
		const mockPage = {
			url: () => "https://test.com",
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "Normal Article",
						url: "/article/1",
						author: null,
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Normal Article" },
						url: { success: true, value: "/article/1" },
					},
					isExcluded: false,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
				{
					values: {
						title: "Excluded Article",
						url: "/article/2",
						author: null,
						date: null,
					},
					fieldResults: {
						title: { success: true, value: "Excluded Article" },
						url: { success: true, value: "/article/2" },
					},
					isExcluded: true,
					hasRequiredFields: true,
					missingRequiredFields: [],
					extractionErrors: [],
				},
			]),
			exposeFunction: vi.fn(),
			removeExposedFunction: vi.fn(),
			waitForSelector: vi.fn(),
		} as unknown as Page;

		const fieldStats: FieldExtractionStats[] = [];
		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfigWithExclude,
			fieldStats,
			0,
		);

		// Should only include non-excluded items
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Normal Article");

		// Should track excluded URLs
		expect(result.excludedUrls).toContain("/article/2");
		expect(result.filteredCount).toBe(1);
	});
});
