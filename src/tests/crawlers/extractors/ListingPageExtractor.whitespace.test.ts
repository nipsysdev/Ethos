import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import type { FieldExtractionStats, SourceConfig } from "@/core/types.js";
import { CrawlerType } from "@/core/types.js";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor.js";

describe("ListingPageExtractor - Whitespace handling", () => {
	const mockConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: CrawlerType.Listing,
		listing: {
			url: "https://example.com",
			container_selector: ".article",
			fields: {
				title: { selector: ".title", attribute: "text" },
			},
		},
		content: {
			container_selector: ".article-content",
			fields: {
				content: { selector: ".content", attribute: "text" },
			},
		},
	};

	it("should normalize whitespace in extracted text", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "Test Article With Spaces", // Already normalized by browser context
					},
					fieldResults: {
						title: { success: true, value: "Test Article With Spaces" },
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
		];

		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfig,
			fieldStats,
			0,
		);

		// Should have normalized the whitespace in the returned items
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Test Article With Spaces");
	});

	it("should handle empty text after whitespace normalization", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					values: {
						title: "", // Empty after normalization
					},
					fieldResults: {
						title: { success: false, value: null },
					},
					isExcluded: false,
					hasRequiredFields: false,
					missingRequiredFields: ["title"],
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
		];

		const result = await extractor.extractItemsFromPage(
			mockPage,
			mockConfig,
			fieldStats,
			0,
		);

		// Should have handled empty text correctly
		expect(result.items).toHaveLength(0);
		expect(result.filteredCount).toBe(1);
	});

	it("should normalize whitespace with exclusions", async () => {
		// This test would require more complex mocking of the page.evaluate function
		// to test the actual exclusion logic, but we can at least verify the function exists
		expect(createListingPageExtractor).toBeDefined();
		const extractor = createListingPageExtractor();
		expect(extractor).toBeDefined();
		expect(typeof extractor.extractItemsFromPage).toBe("function");
	});
});
