import { describe, expect, it } from "vitest";
import type { CrawledData } from "@/core/types.js";
import {
	filterByExclusion,
	filterDuplicates,
} from "@/crawlers/utils/UrlFilter.js";

describe("UrlFilter", () => {
	const mockItems: CrawledData[] = [
		{
			url: "https://example.com/article1",
			title: "Article 1",
			content: "Content 1",
			timestamp: new Date(),
			source: "test",
			metadata: {},
		},
		{
			url: "https://example.com/category/article2",
			title: "Article 2",
			content: "Content 2",
			timestamp: new Date(),
			source: "test",
			metadata: {},
		},
		{
			url: "https://example.com/excluded/article3",
			title: "Article 3",
			content: "Content 3",
			timestamp: new Date(),
			source: "test",
			metadata: {},
		},
	];

	describe("filterByExclusion", () => {
		it("should return all items when no exclusion patterns", () => {
			const result = filterByExclusion(
				mockItems,
				{
					excludePatterns: [],
					baseUrl: "https://example.com",
				},
				0,
			);

			expect(result.filteredItems).toHaveLength(3);
			expect(result.excludedCount).toBe(0);
			expect(result.excludedItemIndices).toEqual([]);
		});

		it("should return all items when exclusion patterns is undefined", () => {
			const result = filterByExclusion(
				mockItems,
				{
					baseUrl: "https://example.com",
				},
				0,
			);

			expect(result.filteredItems).toHaveLength(3);
			expect(result.excludedCount).toBe(0);
			expect(result.excludedItemIndices).toEqual([]);
		});

		it("should filter out URLs matching exclusion patterns", () => {
			const result = filterByExclusion(
				mockItems,
				{
					excludePatterns: ["/excluded/", "/category/"],
					baseUrl: "https://example.com",
				},
				0,
			);

			expect(result.filteredItems).toHaveLength(1);
			expect(result.filteredItems[0].url).toBe("https://example.com/article1");
			expect(result.excludedCount).toBe(2);
			expect(result.excludedItemIndices).toEqual([2, 3]); // 1-based indices
		});

		it("should handle relative URLs by converting to absolute", () => {
			const itemsWithRelativeUrls: CrawledData[] = [
				{
					...mockItems[0],
					url: "/article1",
				},
				{
					...mockItems[1],
					url: "/excluded/article2",
				},
			];

			const result = filterByExclusion(
				itemsWithRelativeUrls,
				{
					excludePatterns: ["/excluded/"],
					baseUrl: "https://example.com",
				},
				0,
			);

			expect(result.filteredItems).toHaveLength(1);
			expect(result.excludedCount).toBe(1);
		});

		it("should use correct offset for excluded item indices", () => {
			const result = filterByExclusion(
				mockItems.slice(0, 2), // First two items
				{
					excludePatterns: ["/category/"],
					baseUrl: "https://example.com",
				},
				10, // Offset
			);

			expect(result.excludedItemIndices).toEqual([12]); // offset + index + 1
		});
	});

	describe("filterDuplicates", () => {
		it("should filter out duplicate URLs", () => {
			const seenUrls = new Set<string>();
			const duplicateItems = [
				mockItems[0],
				mockItems[1],
				mockItems[0], // Duplicate
			];

			const result = filterDuplicates(duplicateItems, seenUrls);

			expect(result).toHaveLength(2);
			expect(result[0].url).toBe("https://example.com/article1");
			expect(result[1].url).toBe("https://example.com/category/article2");
			expect(seenUrls.size).toBe(2);
		});

		it("should add new URLs to the seen set", () => {
			const seenUrls = new Set<string>();

			const result = filterDuplicates(mockItems.slice(0, 2), seenUrls);

			expect(result).toHaveLength(2);
			expect(seenUrls.has("https://example.com/article1")).toBe(true);
			expect(seenUrls.has("https://example.com/category/article2")).toBe(true);
		});

		it("should respect existing URLs in the seen set", () => {
			const seenUrls = new Set(["https://example.com/article1"]);

			const result = filterDuplicates(mockItems.slice(0, 2), seenUrls);

			expect(result).toHaveLength(1);
			expect(result[0].url).toBe("https://example.com/category/article2");
		});

		it("should handle empty input", () => {
			const seenUrls = new Set<string>();

			const result = filterDuplicates([], seenUrls);

			expect(result).toHaveLength(0);
			expect(seenUrls.size).toBe(0);
		});
	});
});
