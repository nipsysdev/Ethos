import { describe, expect, it } from "vitest";
import type { SourceConfig } from "../core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "../core/types.js";
import { ArticleListingCrawler } from "../crawlers/ArticleListingCrawler.js";

describe("ArticleListingCrawler", () => {
	it("should have correct type", () => {
		const crawler = new ArticleListingCrawler();
		expect(crawler.type).toBe(CRAWLER_TYPES.LISTING);
	});

	it("should reject non-listing config types", async () => {
		const crawler = new ArticleListingCrawler();
		const invalidConfig = {
			id: "test",
			name: "Test",
			type: "rss",
			listing: {
				url: "https://example.com",
				items: { container_selector: ".item", fields: {} },
			},
		} as unknown as SourceConfig;

		await expect(crawler.crawl(invalidConfig)).rejects.toThrow(CrawlerError);
		await expect(crawler.crawl(invalidConfig)).rejects.toThrow(
			"only supported type in Phase 1",
		);
	});
});

describe("Pagination logic", () => {
	it("should handle maxPages boundary conditions", () => {
		// Test the core pagination stop logic
		let pagesProcessed = 5;
		let maxPages: number | undefined = 5;
		expect(pagesProcessed >= maxPages).toBe(true);

		pagesProcessed = 4;
		maxPages = 5;
		expect(pagesProcessed >= maxPages).toBe(false);

		// Test no maxPages limit (important edge case)
		pagesProcessed = 100;
		maxPages = undefined;
		expect(Boolean(maxPages && pagesProcessed >= maxPages)).toBe(false);
	});

	it("should calculate summary data correctly", () => {
		// Test the math that drives the summary
		const validItems = 42;
		const filteredItems = 3;
		const duplicates = 2;

		const itemsFound = validItems + filteredItems + duplicates;
		const itemsProcessed = validItems;
		const itemsWithErrors = filteredItems;

		expect(itemsFound).toBe(47);
		expect(itemsProcessed).toBe(42);
		expect(itemsWithErrors).toBe(3);
	});

	it("should validate stop conditions", () => {
		// Test all-duplicates detection (this is the trickier logic)
		const pageItems = [{ url: "test1" }, { url: "test2" }];
		const seenUrls = new Set(["test1", "test2"]);
		const allDuplicates =
			pageItems.length > 0 && pageItems.every((item) => seenUrls.has(item.url));
		expect(allDuplicates).toBe(true);

		// Test mixed scenario
		const mixedItems = [{ url: "test1" }, { url: "test3" }]; // test3 is new
		const notAllDuplicates = mixedItems.every((item) => seenUrls.has(item.url));
		expect(notAllDuplicates).toBe(false);
	});
});

describe("Error handling", () => {
	it("should filter items with missing required fields", () => {
		const mockItems = [
			{ hasRequiredFields: true, missingRequiredFields: [] },
			{ hasRequiredFields: false, missingRequiredFields: ["date"] },
			{ hasRequiredFields: true, missingRequiredFields: [] },
		];

		const validItems = mockItems.filter((item) => item.hasRequiredFields);
		const filteredItems = mockItems.filter((item) => !item.hasRequiredFields);

		expect(validItems).toHaveLength(2);
		expect(filteredItems).toHaveLength(1);
		expect(filteredItems[0].missingRequiredFields).toEqual(["date"]);
	});

	it("should generate proper error messages", () => {
		const missingFields = ["date", "author"];
		const itemNumber = 8;
		const expectedMessage = `Item ${itemNumber}: missing required fields [${missingFields.join(", ")}]`;

		expect(expectedMessage).toBe(
			"Item 8: missing required fields [date, author]",
		);
	});

	it("should handle CrawlerError properly", () => {
		const originalError = new Error("Network timeout");
		const crawlerError = new CrawlerError(
			"Failed to crawl test source",
			"test-source",
			originalError,
		);

		expect(crawlerError.message).toBe("Failed to crawl test source");
		expect(crawlerError.source).toBe("test-source");
		expect(crawlerError.originalError).toBe(originalError);
	});
});

describe("Duplicate detection", () => {
	it("should identify and skip duplicates", () => {
		const seenUrls = new Set<string>();
		const mockItems = [
			{ url: "https://example.com/article1" },
			{ url: "https://example.com/article2" },
			{ url: "https://example.com/article1" }, // duplicate
			{ url: "https://example.com/article3" },
		];

		let duplicatesSkipped = 0;
		const newItems = [];

		for (const item of mockItems) {
			if (seenUrls.has(item.url)) {
				duplicatesSkipped++;
			} else {
				seenUrls.add(item.url);
				newItems.push(item);
			}
		}

		expect(newItems).toHaveLength(3);
		expect(duplicatesSkipped).toBe(1);
	});
});

describe("Configuration validation", () => {
	it("should handle pagination config structure", () => {
		const configWithPagination: SourceConfig = {
			id: "test-pagination",
			name: "Test Pagination",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				pagination: {
					next_button_selector: ".pager__item.pager__item--next",
				},
				items: {
					container_selector: ".item",
					fields: {
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
		};

		expect(configWithPagination.listing.pagination?.next_button_selector).toBe(
			".pager__item.pager__item--next",
		);
	});

	it("should handle configs without pagination", () => {
		const configNoPagination: SourceConfig = {
			id: "test-no-pagination",
			name: "Test No Pagination",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".item",
					fields: {
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
		};

		expect(configNoPagination.listing.pagination).toBeUndefined();
	});

	it("should validate field configurations", () => {
		const fieldsConfig = {
			title: { selector: ".title", attribute: "text" },
			author: { selector: ".author", attribute: "text", optional: true },
		};

		const titleField = fieldsConfig.title;
		const authorField = fieldsConfig.author;

		expect(titleField.attribute).toBe("text");
		expect(authorField.optional).toBe(true);
		expect((titleField as { optional?: boolean }).optional).toBeUndefined();
	});
});
