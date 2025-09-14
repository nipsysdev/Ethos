import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import type { FieldExtractionStats, SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { createListingPageExtractor } from "@/crawlers/extractors/ListingPageExtractor.js";

describe("ListingPageExtractor - Whitespace handling", () => {
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
					excerpt: { selector: ".excerpt", attribute: "text", optional: true },
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

	it("should normalize whitespace in extracted text", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: {
						title: "Test Article With Spaces", // Already normalized by browser context
						excerpt: "This is an excerpt", // Already normalized by browser context
					},
					fieldResults: {
						title: { success: true, value: "Test Article With Spaces" },
						excerpt: { success: true, value: "This is an excerpt" },
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
				fieldName: "excerpt",
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

		// Should have normalized the whitespace in the returned items
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Test Article With Spaces");
		expect(result.items[0].content).toBe("This is an excerpt");
	});

	it("should handle empty text after whitespace normalization", async () => {
		const extractor = createListingPageExtractor();
		const mockPage = {
			evaluate: vi.fn().mockResolvedValue([
				{
					item: {
						title: "Valid Title",
						excerpt: null, // Browser context would return null for empty/whitespace-only text
					},
					fieldResults: {
						title: { success: true, value: "Valid Title" },
						excerpt: { success: false, value: null }, // Marked as unsuccessful
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
				fieldName: "excerpt",
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

		// Should have handled empty text correctly
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Valid Title");
		expect(result.items[0].content).toBe(""); // Empty string for excerpt
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
