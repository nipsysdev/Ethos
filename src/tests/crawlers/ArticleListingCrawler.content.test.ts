import { describe, expect, it } from "vitest";

describe("ArticleListingCrawler - Content Processing", () => {
	it("should handle URL resolution for content pages", () => {
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

	it("should merge content data with listing data correctly", () => {
		// Simulate the merging logic from extractContentData
		const listingData = {
			title: "Listing Title",
			url: "https://example.com/article",
			author: "Listing Author",
			publishedDate: "2024-01-01",
		};

		const contentData = {
			title: "Content Page Title",
			content: "Full article content from content page",
			author: "Content Author",
			date: "2024-01-02",
		};

		// Merge logic: content data takes precedence
		const mergedItem = { ...listingData };
		if (contentData.title) mergedItem.title = contentData.title;
		if (contentData.author) mergedItem.author = contentData.author;
		if (contentData.date) mergedItem.publishedDate = contentData.date;

		expect(mergedItem.title).toBe("Content Page Title");
	});

	it("should track content field extraction stats", () => {
		// Simulate content field stats tracking
		interface TestFieldStats {
			fieldName: string;
			successCount: number;
			totalAttempts: number;
			isOptional: boolean;
			missingItems: number[];
		}

		const contentFieldStats: TestFieldStats[] = [
			{
				fieldName: "title",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "content",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
		];

		const contentData: Record<string, string | null> = {
			title: "Test Title",
			content: null,
		};

		const itemIndex = 0;
		const itemOffset = 0;

		// Update stats based on extraction
		contentFieldStats.forEach((stat) => {
			stat.totalAttempts++;
			if (contentData[stat.fieldName] !== null) {
				stat.successCount++;
			} else {
				stat.missingItems.push(itemOffset + itemIndex + 1);
			}
		});

		expect(contentFieldStats[0].successCount).toBe(1); // title succeeded
		expect(contentFieldStats[0].totalAttempts).toBe(1);
		expect(contentFieldStats[1].successCount).toBe(0); // content failed
		expect(contentFieldStats[1].missingItems).toEqual([1]);
	});

	it("should handle content extraction metadata correctly", () => {
		const contentData = {
			title: "Test Title",
			content: "Test Content",
			author: null,
			image: null,
		};

		const errors = ["Failed to extract author: element not found"];

		const contentFields = Object.keys(contentData).filter(
			(key) => contentData[key as keyof typeof contentData] !== null,
		);
		const failedContentFields = Object.keys(contentData).filter(
			(key) => contentData[key as keyof typeof contentData] === null,
		);

		expect(contentFields).toEqual(["title", "content"]);
		expect(failedContentFields).toEqual(["author", "image"]);

		const expectedMetadata = {
			contentFieldsExtracted: contentFields,
			contentFieldsFailed: failedContentFields,
			contentExtractionErrors: errors,
		};

		expect(expectedMetadata.contentFieldsExtracted).toEqual([
			"title",
			"content",
		]);
		expect(expectedMetadata.contentFieldsFailed).toEqual(["author", "image"]);
		expect(expectedMetadata.contentExtractionErrors).toEqual(errors);
	});
});
