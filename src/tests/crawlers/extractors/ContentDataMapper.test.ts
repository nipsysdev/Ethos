import { describe, expect, it, vi } from "vitest";
import type { CrawledData, FieldExtractionStats } from "@/core/types.js";
import {
	mergeContentData,
	updateFieldStats,
	updateItemMetadata,
} from "@/crawlers/extractors/ContentDataMapper";
import { parsePublishedDate } from "@/utils/date.js";

// Mock the parsePublishedDate function
vi.mock("@/utils/date.js", () => ({
	parsePublishedDate: vi.fn((dateString: string) => `parsed-${dateString}`),
}));

describe("ContentDataMapper", () => {
	describe("mergeContentData", () => {
		it("should merge content data into crawled item", () => {
			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Listing Title",
				content: "Listing content",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const contentData = {
				title: "Full Title",
				content: "Full content",
				author: "John Doe",
				date: "2023-01-01",
			};

			mergeContentData(item, contentData);

			// Should overwrite existing fields with content data
			expect(item.title).toBe("Full Title");
			expect(item.content).toBe("Full content");
			expect(item.author).toBe("John Doe");
			expect(item.publishedDate).toBe("parsed-2023-01-01");
		});

		it("should only update fields that exist in content data", () => {
			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Listing Title",
				content: "Listing content",
				author: "Existing Author",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const contentData = {
				title: "Full Title",
				// content is missing
				// author is missing
				date: "2023-01-01",
			};

			mergeContentData(item, contentData);

			// Should update title and date
			expect(item.title).toBe("Full Title");
			expect(item.publishedDate).toBe("parsed-2023-01-01");

			// Should preserve existing content and author
			expect(item.content).toBe("Listing content");
			expect(item.author).toBe("Existing Author");
		});

		it("should handle null/undefined content data fields", () => {
			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Listing Title",
				content: "Listing content",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const contentData = {};

			mergeContentData(item, contentData);

			// Should not update fields with null/undefined values
			expect(item.title).toBe("Listing Title");
			expect(item.content).toBe("Listing content");
			expect(item.author).toBeUndefined();
			expect(item.publishedDate).toBeUndefined();
		});

		it("should handle missing date field", () => {
			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Listing Title",
				content: "Listing content",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const contentData = {
				title: "Full Title",
			};

			mergeContentData(item, contentData);

			// Should not set publishedDate when date is missing
			expect(item.publishedDate).toBeUndefined();
		});

		it("should throw error when date parsing fails", () => {
			// Mock parsePublishedDate to throw an error
			vi.mocked(parsePublishedDate).mockImplementationOnce(() => {
				throw new Error("Invalid date format");
			});

			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Listing Title",
				content: "Listing content",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const contentData = {
				date: "invalid-date",
			};

			expect(() => mergeContentData(item, contentData)).toThrow(
				'Date parsing failed for content page "https://example.com/article": Invalid date format',
			);
		});
	});

	describe("updateFieldStats", () => {
		it("should update field statistics correctly", () => {
			const contentData: { [key: string]: string | null } = {
				title: "Article Title",
				content: "Article Content",
				author: null,
				date: null,
			};

			// Cast to ContentExtractionData
			const contentDataTyped =
				contentData as unknown as import("@/crawlers/extractors/ContentPageExtractor").ContentExtractionData;

			const contentFieldStats: FieldExtractionStats[] = [
				{
					fieldName: "title",
					successCount: 5,
					totalAttempts: 10,
					isOptional: false,
					missingItems: [1, 3],
				},
				{
					fieldName: "content",
					successCount: 8,
					totalAttempts: 10,
					isOptional: false,
					missingItems: [2],
				},
				{
					fieldName: "author",
					successCount: 3,
					totalAttempts: 10,
					isOptional: true,
					missingItems: [1, 4, 5],
				},
			];

			const result = updateFieldStats(contentDataTyped, contentFieldStats, 5);

			// Should return correct content and failed fields
			expect(result.contentFields).toEqual(["title", "content"]);
			expect(result.failedContentFields).toEqual(["author", "date"]);

			// Should update statistics for all fields
			expect(contentFieldStats[0].totalAttempts).toBe(11);
			expect(contentFieldStats[0].successCount).toBe(6); // title succeeded
			expect(contentFieldStats[0].missingItems).toEqual([1, 3]);

			expect(contentFieldStats[1].totalAttempts).toBe(11);
			expect(contentFieldStats[1].successCount).toBe(9); // content succeeded
			expect(contentFieldStats[1].missingItems).toEqual([2]);

			expect(contentFieldStats[2].totalAttempts).toBe(11);
			expect(contentFieldStats[2].successCount).toBe(3); // author still failed
			expect(contentFieldStats[2].missingItems).toEqual([1, 4, 5, 6]); // item 6 (index 5 + 1) added
		});

		it("should handle empty content data", () => {
			const contentData = {};

			const contentFieldStats: FieldExtractionStats[] = [
				{
					fieldName: "title",
					successCount: 5,
					totalAttempts: 10,
					isOptional: false,
					missingItems: [1, 3],
				},
			];

			const result = updateFieldStats(contentData, contentFieldStats, 1);

			// Should return empty arrays
			expect(result.contentFields).toEqual([]);
			expect(result.failedContentFields).toEqual([]);

			// Should still update statistics
			expect(contentFieldStats[0].totalAttempts).toBe(11);
			expect(contentFieldStats[0].successCount).toBe(5); // no change
			expect(contentFieldStats[0].missingItems).toEqual([1, 3, 2]); // item 2 (index 1 + 1) added
		});
	});

	describe("updateItemMetadata", () => {
		it("should update item metadata with extraction results", () => {
			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Article Title",
				content: "Article Content",
				crawledAt: new Date(),
				source: "test",
				metadata: {
					existingField: "existingValue",
				},
			};

			const contentFields = ["title", "content"];
			const failedContentFields = ["author", "date"];
			const errors = ["Failed to extract author", "Failed to extract date"];

			updateItemMetadata(item, contentFields, failedContentFields, errors);

			// Should preserve existing metadata
			expect(item.metadata.existingField).toBe("existingValue");

			// Should add new metadata fields
			expect(item.metadata.contentFieldsExtracted).toEqual([
				"title",
				"content",
			]);
			expect(item.metadata.contentFieldsFailed).toEqual(["author", "date"]);
			expect(item.metadata.contentExtractionErrors).toEqual([
				"Failed to extract author",
				"Failed to extract date",
			]);
		});

		it("should handle empty arrays and errors", () => {
			const item: CrawledData = {
				url: "https://example.com/article",
				title: "Article Title",
				content: "Article Content",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			updateItemMetadata(item, [], [], []);

			// Should set empty arrays
			expect(item.metadata.contentFieldsExtracted).toEqual([]);
			expect(item.metadata.contentFieldsFailed).toEqual([]);
			expect(item.metadata.contentExtractionErrors).toEqual([]);
		});
	});
});
