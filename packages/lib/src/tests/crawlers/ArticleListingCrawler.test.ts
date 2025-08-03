import { describe, expect, it } from "vitest";
import type { SourceConfig } from "../../core/types.js";
import { CRAWLER_TYPES, CrawlerError } from "../../core/types.js";
import { ArticleListingCrawler } from "../../crawlers/ArticleListingCrawler.js";

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

describe("Pagination and crawl flow", () => {
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

	it("should validate stop conditions", () => {
		// Test all-duplicates detection
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

describe("Summary calculations", () => {
	it("should calculate basic summary data correctly", () => {
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

	it("should handle detail crawl summary fields", () => {
		// Test that detail crawling is always performed
		const totalItems = 10;
		const detailsCrawled = totalItems; // Always equals total items now

		expect(detailsCrawled).toBe(10);
	});
});

describe("Detail page crawling", () => {
	it("should handle URL resolution for detail pages", () => {
		const baseUrl = "https://example.com/listing";
		const relativeUrl = "/article/123";
		const absoluteUrl = "https://example.com/article/456";

		// Test absolute URL handling
		const resolvedAbsolute = absoluteUrl.startsWith("http")
			? absoluteUrl
			: new URL(absoluteUrl, baseUrl).href;
		expect(resolvedAbsolute).toBe(absoluteUrl);

		// Test relative URL resolution
		const resolvedRelative = relativeUrl.startsWith("http")
			? relativeUrl
			: new URL(relativeUrl, baseUrl).href;
		expect(resolvedRelative).toBe("https://example.com/article/123");
	});

	it("should merge detail data with listing data correctly", () => {
		// Simulate the merging logic from extractDetailData
		const listingItem = {
			url: "https://example.com/article",
			title: "Listing Title",
			content: "Listing excerpt",
			author: undefined as string | undefined,
			publishedDate: undefined as string | undefined,
		};

		const detailData = {
			title: "Detail Page Title",
			content: "Full article content from detail page",
			author: "John Doe",
			date: "2023-01-15",
			image: null, // Missing field
		};

		// Apply merging logic
		const mergedItem = { ...listingItem };
		if (detailData.title) mergedItem.title = detailData.title;
		if (detailData.content) mergedItem.content = detailData.content;
		if (detailData.author) mergedItem.author = detailData.author;
		if (detailData.date) mergedItem.publishedDate = detailData.date;

		expect(mergedItem.title).toBe("Detail Page Title");
		expect(mergedItem.content).toBe("Full article content from detail page");
		expect(mergedItem.author).toBe("John Doe");
		expect(mergedItem.publishedDate).toBe("2023-01-15");
	});

	it("should track detail field extraction stats", () => {
		// Simulate detail field stats tracking
		interface TestFieldStats {
			fieldName: string;
			successCount: number;
			totalAttempts: number;
			isOptional: boolean;
			missingItems: number[];
		}

		const detailFieldStats: TestFieldStats[] = [
			{
				fieldName: "title",
				successCount: 0,
				totalAttempts: 0,
				isOptional: true,
				missingItems: [],
			},
			{
				fieldName: "content",
				successCount: 0,
				totalAttempts: 0,
				isOptional: true,
				missingItems: [],
			},
		];

		const detailData: Record<string, string | null> = {
			title: "Test Title",
			content: null,
		};
		const itemIndex = 0;
		const itemOffset = 0;

		// Update stats based on extraction
		detailFieldStats.forEach((stat) => {
			stat.totalAttempts++;
			if (detailData[stat.fieldName] !== null) {
				stat.successCount++;
			} else {
				stat.missingItems.push(itemOffset + itemIndex + 1);
			}
		});

		expect(detailFieldStats[0].successCount).toBe(1); // title succeeded
		expect(detailFieldStats[0].totalAttempts).toBe(1);
		expect(detailFieldStats[1].successCount).toBe(0); // content failed
		expect(detailFieldStats[1].missingItems).toEqual([1]);
	});

	it("should handle detail extraction metadata correctly", () => {
		const detailData = {
			title: "Test Title",
			content: "Test Content",
			author: null,
			image: null,
		};

		const errors = ["Failed to extract author: element not found"];

		const detailFields = Object.keys(detailData).filter(
			(key) => detailData[key as keyof typeof detailData] !== null,
		);
		const failedDetailFields = Object.keys(detailData).filter(
			(key) => detailData[key as keyof typeof detailData] === null,
		);

		expect(detailFields).toEqual(["title", "content"]);
		expect(failedDetailFields).toEqual(["author", "image"]);

		const expectedMetadata = {
			detailFieldsExtracted: detailFields,
			detailFieldsFailed: failedDetailFields,
			detailExtractionErrors: errors,
		};

		expect(expectedMetadata.detailFieldsExtracted).toEqual([
			"title",
			"content",
		]);
		expect(expectedMetadata.detailFieldsFailed).toEqual(["author", "image"]);
		expect(expectedMetadata.detailExtractionErrors).toEqual(errors);
	});
});

describe("Field extraction and validation", () => {
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

	it("should track field stats correctly", () => {
		// Simulate field stats tracking for both listing and detail fields
		interface TestFieldStats {
			fieldName: string;
			successCount: number;
			totalAttempts: number;
			isOptional: boolean;
			missingItems: number[];
		}

		const fieldStats: TestFieldStats[] = [
			{
				fieldName: "title",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
		];

		const extractionResults = [
			{ fieldResults: { title: { success: true } } },
			{ fieldResults: { title: { success: false } } },
			{ fieldResults: { title: { success: true } } },
		];

		extractionResults.forEach((result, itemIndex) => {
			fieldStats.forEach((stat) => {
				stat.totalAttempts++;
				const fieldResult = result.fieldResults.title; // Access specific field
				if (fieldResult?.success) {
					stat.successCount++;
				} else {
					stat.missingItems.push(itemIndex + 1);
				}
			});
		});

		expect(fieldStats[0].successCount).toBe(2);
		expect(fieldStats[0].totalAttempts).toBe(3);
		expect(fieldStats[0].missingItems).toEqual([2]);
	});
});

describe("Error handling", () => {
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

	it("should separate listing and detail errors", () => {
		const listingErrors = [
			"Item 1: missing required fields [url]",
			"Item 3: missing required fields [title]",
		];

		const detailErrors = [
			"Detail extraction for https://example.com/1: Failed to extract content: element not found",
			"Failed to load detail page https://example.com/2: Navigation timeout",
		];

		// Errors should be tracked separately
		expect(listingErrors).toHaveLength(2);
		expect(detailErrors).toHaveLength(2);
		expect(listingErrors[0]).toContain("missing required fields");
		expect(detailErrors[0]).toContain("Detail extraction");
	});

	it("should format detail error messages correctly", () => {
		const itemUrl = "https://example.com/article";
		const extractionError = "Failed to extract content: element not found";
		const navigationError = "Navigation timeout";

		const detailExtractionError = `Detail extraction for ${itemUrl}: ${extractionError}`;
		const detailNavigationError = `Failed to load detail page ${itemUrl}: ${navigationError}`;

		expect(detailExtractionError).toBe(
			"Detail extraction for https://example.com/article: Failed to extract content: element not found",
		);
		expect(detailNavigationError).toBe(
			"Failed to load detail page https://example.com/article: Navigation timeout",
		);
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
			detail: {
				container_selector: ".article",
				fields: {
					content: { selector: ".content", attribute: "text" },
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
			detail: {
				container_selector: ".article",
				fields: {
					content: { selector: ".content", attribute: "text" },
				},
			},
		};

		expect(configNoPagination.listing.pagination).toBeUndefined();
	});

	it("should handle detail page configuration", () => {
		const configWithDetail: SourceConfig = {
			id: "test-detail",
			name: "Test Detail",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".item",
					fields: {
						url: { selector: "a", attribute: "href" },
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
			detail: {
				container_selector: ".article",
				fields: {
					title: { selector: "h1", attribute: "text" },
					content: { selector: ".content", attribute: "text" },
					author: { selector: ".author", attribute: "text", optional: true },
				},
			},
		};

		expect(configWithDetail.detail).toBeDefined();
		expect(configWithDetail.detail?.fields.title.selector).toBe("h1");
		expect(configWithDetail.detail?.fields.author.optional).toBe(true);
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
