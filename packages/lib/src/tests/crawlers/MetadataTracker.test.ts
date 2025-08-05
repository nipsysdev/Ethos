import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrawledData, SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { MetadataTracker } from "@/crawlers/MetadataTracker.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

// Create mock MetadataStore instance
const mockCreateSession = vi.fn();
const mockUpdateSession = vi.fn();
const mockGetSession = vi.fn();
const mockEndSession = vi.fn();
const mockCheckpoint = vi.fn();

const mockMetadataStore: Partial<MetadataStore> = {
	createSession: mockCreateSession,
	updateSession: mockUpdateSession,
	getSession: mockGetSession,
	endSession: mockEndSession,
	checkpoint: mockCheckpoint,
};

describe("MetadataTracker", () => {
	let metadataTracker: MetadataTracker;
	let mockConfig: SourceConfig;
	let startTime: Date;

	beforeEach(() => {
		// Clear mocks before each test
		vi.clearAllMocks();
		mockCreateSession.mockClear();
		mockUpdateSession.mockClear();
		mockGetSession.mockClear();
		mockEndSession.mockClear();
		mockCheckpoint.mockClear();

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

		// Pass the mock MetadataStore to the constructor
		metadataTracker = new MetadataTracker(
			mockConfig,
			startTime,
			mockMetadataStore as MetadataStore,
		);
	});

	it("should initialize metadata correctly", () => {
		const metadata = metadataTracker.getMetadata();

		expect(metadata.itemsProcessed).toBe(0);
		expect(metadata.duplicatesSkipped).toBe(0);
		expect(metadata.totalFilteredItems).toBe(0);
		expect(metadata.pagesProcessed).toBe(0);
		expect(metadata.detailsCrawled).toBe(0);
		expect(metadata.fieldStats).toHaveLength(3); // title, url, publishedDate
		expect(metadata.detailFieldStats).toHaveLength(1); // summary
		expect(metadata.listingErrors).toEqual([]);
		expect(metadata.detailErrors).toEqual([]);
	});

	it("should provide a session ID", () => {
		const sessionId = metadataTracker.getSessionId();
		expect(typeof sessionId).toBe("string");
		expect(sessionId).toMatch(/^crawl-session-\d+$/); // Format: crawl-session-[epoch-timestamp]
		expect(sessionId).toContain("crawl-session-");
	});

	it("should create a session in the database on initialization", () => {
		expect(mockCreateSession).toHaveBeenCalledWith(
			expect.stringMatching(/^crawl-session-\d+$/), // Epoch timestamp format
			"test-source",
			"Test Source",
			startTime,
			expect.objectContaining({
				duplicatesSkipped: 0,
				totalFilteredItems: 0,
				itemsProcessed: 0,
			}),
		);
	});

	it("should track page processing", () => {
		metadataTracker.incrementPagesProcessed();
		metadataTracker.incrementPagesProcessed();

		const metadata = metadataTracker.getMetadata();
		expect(metadata.pagesProcessed).toBe(2);

		// Check that the session is updated in the database
		expect(mockUpdateSession).toHaveBeenCalledTimes(2);
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

	it("should add items and track URLs", () => {
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
		expect(metadata.itemsProcessed).toBe(2);
	});

	it("should build crawl result and close session", () => {
		// Mock getSession to return session data
		mockGetSession.mockReturnValue({
			id: metadataTracker.getSessionId(),
			sourceId: "test-source",
			sourceName: "Test Source",
			startTime: startTime,
			endTime: null,
			metadata: "{}",
			createdAt: startTime,
			updatedAt: startTime,
		});

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
		expect(result.summary.sessionId).toBe(metadataTracker.getSessionId());

		// Check that the session was ended
		expect(mockEndSession).toHaveBeenCalledWith(metadataTracker.getSessionId());
	});

	it("should handle items correctly without depending on itemsForViewer", () => {
		// Mock getSession to return session data
		mockGetSession.mockReturnValue({
			id: metadataTracker.getSessionId(),
			sourceId: "test-source",
			sourceName: "Test Source",
			startTime: startTime,
			endTime: null,
			metadata: "{}",
			createdAt: startTime,
			updatedAt: startTime,
		});

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
	});

	describe("Checkpoint Management", () => {
		it("should have a checkpoint method", () => {
			expect(typeof metadataTracker.checkpoint).toBe("function");
		});

		it("should execute checkpoint without error", () => {
			// This should not throw
			expect(() => metadataTracker.checkpoint()).not.toThrow();
		});

		it("should call checkpoint on the metadata store", () => {
			metadataTracker.checkpoint();

			expect(mockCheckpoint).toHaveBeenCalledOnce();
		});
	});
});
