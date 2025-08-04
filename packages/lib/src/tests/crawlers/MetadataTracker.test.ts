import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrawledData, SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { MetadataTracker } from "@/crawlers/MetadataTracker.js";

// Mock the CLI import to avoid issues in test environment
vi.mock("@/cli/index.js", () => ({
	registerTempFile: vi.fn(),
}));

describe("MetadataTracker", () => {
	let metadataTracker: MetadataTracker;
	let mockConfig: SourceConfig;
	let startTime: Date;

	beforeEach(() => {
		startTime = new Date();
		mockConfig = {
			id: "test-source",
			name: "Test Source",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".item",
					fields: {
						title: { selector: "h2", attribute: "text", optional: false },
						url: { selector: "a", attribute: "href", optional: false },
						publishedDate: {
							selector: ".date",
							attribute: "text",
							optional: true,
						},
					},
				},
			},
			detail: {
				container_selector: ".article",
				fields: {
					summary: { selector: ".summary", attribute: "text", optional: true },
				},
			},
		};

		metadataTracker = new MetadataTracker(mockConfig, startTime);
	});

	it("should initialize metadata correctly", () => {
		const metadata = metadataTracker.getMetadata();

		expect(metadata.sourceId).toBe("test-source");
		expect(metadata.sourceName).toBe("Test Source");
		expect(metadata.startTime).toBe(startTime);
		expect(metadata.itemUrls).toEqual([]);
		expect(metadata.itemsForViewer).toEqual([]);
		expect(metadata.duplicatesSkipped).toBe(0);
		expect(metadata.totalFilteredItems).toBe(0);
		expect(metadata.pagesProcessed).toBe(0);
		expect(metadata.detailsCrawled).toBe(0);
		expect(metadata.fieldStats).toHaveLength(3); // title, url, publishedDate
		expect(metadata.detailFieldStats).toHaveLength(1); // summary
		expect(metadata.listingErrors).toEqual([]);
		expect(metadata.detailErrors).toEqual([]);
	});

	it("should provide a temp file path", () => {
		const tempFilePath = metadataTracker.getTempFilePath();
		expect(tempFilePath).toContain("ethos-crawl-");
		expect(tempFilePath).toContain(".json");
	});

	it("should track page processing", () => {
		metadataTracker.incrementPagesProcessed();
		metadataTracker.incrementPagesProcessed();

		const metadata = metadataTracker.getMetadata();
		expect(metadata.pagesProcessed).toBe(2);
	});

	it("should track duplicates", () => {
		metadataTracker.addDuplicatesSkipped(3);
		metadataTracker.addDuplicatesSkipped(2);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.duplicatesSkipped).toBe(5);
	});

	it("should track filtered items", () => {
		metadataTracker.addFilteredItems(2, ["Missing title", "Invalid URL"]);
		metadataTracker.addFilteredItems(1, ["Missing date"]);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.totalFilteredItems).toBe(3);
		expect(metadata.listingErrors).toEqual([
			"Missing title",
			"Invalid URL",
			"Missing date",
		]);
	});

	it("should track details crawled", () => {
		metadataTracker.addDetailsCrawled(5);
		metadataTracker.addDetailsCrawled(3);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.detailsCrawled).toBe(8);
	});

	it("should set stopped reason", () => {
		metadataTracker.setStoppedReason("max_pages");

		const metadata = metadataTracker.getMetadata();
		expect(metadata.stoppedReason).toBe("max_pages");
	});

	it("should add items and generate metadata for viewer", () => {
		const mockItems: CrawledData[] = [
			{
				url: "https://example.com/article1",
				title: "Article 1",
				publishedDate: "2024-01-01",
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 1",
				metadata: {},
			},
			{
				url: "https://example.com/article2",
				title: "Article 2",
				publishedDate: "2024-01-02",
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 2",
				metadata: {},
			},
		];

		metadataTracker.addItems(mockItems);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.itemUrls).toEqual([
			"https://example.com/article1",
			"https://example.com/article2",
		]);
		expect(metadata.itemsForViewer).toHaveLength(2);
		expect(metadata.itemsForViewer[0]).toMatchObject({
			url: "https://example.com/article1",
			title: "Article 1",
			publishedDate: "2024-01-01",
		});
		expect(metadata.itemsForViewer[0].hash).toBeDefined();
		expect(metadata.itemsForViewer[0].hash).toHaveLength(40); // SHA-1 hash length
	});

	it("should build crawl result with sorted items", () => {
		// Add items with different dates
		const mockItems: CrawledData[] = [
			{
				url: "https://example.com/article1",
				title: "Article 1",
				publishedDate: "2024-01-01",
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 1",
				metadata: {},
			},
			{
				url: "https://example.com/article2",
				title: "Article 2",
				publishedDate: "2024-01-03", // Newer
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 2",
				metadata: {},
			},
			{
				url: "https://example.com/article3",
				title: "Article 3",
				publishedDate: "2024-01-02",
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 3",
				metadata: {},
			},
		];

		metadataTracker.addItems(mockItems);
		metadataTracker.incrementPagesProcessed();
		metadataTracker.addDuplicatesSkipped(1);
		metadataTracker.setStoppedReason("no_next_button");

		const result = metadataTracker.buildCrawlResult();

		expect(result.data).toEqual([]); // Should be empty since items processed immediately
		expect(result.summary.sourceId).toBe("test-source");
		expect(result.summary.itemsProcessed).toBe(3);
		expect(result.summary.duplicatesSkipped).toBe(1);
		expect(result.summary.pagesProcessed).toBe(1);
		expect(result.summary.stoppedReason).toBe("no_next_button");
		expect(result.summary.tempMetadataFile).toBe(
			metadataTracker.getTempFilePath(),
		);

		// Check that items are sorted by date (newest first)
		const metadata = metadataTracker.getMetadata();
		expect(metadata.itemsForViewer[0].publishedDate).toBe("2024-01-03"); // Newest first
		expect(metadata.itemsForViewer[1].publishedDate).toBe("2024-01-02");
		expect(metadata.itemsForViewer[2].publishedDate).toBe("2024-01-01");
	});

	it("should handle items without published dates when sorting", () => {
		const mockItems: CrawledData[] = [
			{
				url: "https://example.com/article1",
				title: "Article 1",
				// No published date
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 1",
				metadata: {},
			},
			{
				url: "https://example.com/article2",
				title: "Article 2",
				publishedDate: "2024-01-01",
				timestamp: new Date(),
				source: "test-source",
				content: "Test content 2",
				metadata: {},
			},
		];

		metadataTracker.addItems(mockItems);
		const result = metadataTracker.buildCrawlResult();

		// Should not throw an error and should complete successfully
		expect(result.summary.itemsProcessed).toBe(2);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.itemsForViewer).toHaveLength(2);
		// Item with date should come first (newer items first, undefined dates last)
		expect(metadata.itemsForViewer[0].publishedDate).toBe("2024-01-01");
		expect(metadata.itemsForViewer[1].publishedDate).toBeUndefined();
	});
});
