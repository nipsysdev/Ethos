import { describe, expect, it } from "vitest";

describe("Published date sorting", () => {
	it("should sort items by published date (newest first)", () => {
		// Mock itemsForViewer data with different published dates
		const itemsForViewer = [
			{
				url: "/article/1",
				title: "Oldest Article",
				hash: "hash1",
				publishedDate: "2020-01-01T00:00:00.000Z",
			},
			{
				url: "/article/2",
				title: "Newest Article",
				hash: "hash2",
				publishedDate: "2023-12-31T00:00:00.000Z",
			},
			{
				url: "/article/3",
				title: "Middle Article",
				hash: "hash3",
				publishedDate: "2022-06-15T00:00:00.000Z",
			},
			{
				url: "/article/4",
				title: "No Date Article",
				hash: "hash4",
				// No publishedDate
			},
		];

		// Apply the same sorting logic as in buildCrawlResultFromMetadata
		itemsForViewer.sort((a, b) => {
			// Handle cases where publishedDate might be undefined
			const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
			const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;

			// Sort newest first (descending order)
			return dateB - dateA;
		});

		// Expected order: newest first, then middle, then oldest, then no date (treated as 0)
		expect(itemsForViewer[0].title).toBe("Newest Article");
		expect(itemsForViewer[1].title).toBe("Middle Article");
		expect(itemsForViewer[2].title).toBe("Oldest Article");
		expect(itemsForViewer[3].title).toBe("No Date Article");
	});
});
