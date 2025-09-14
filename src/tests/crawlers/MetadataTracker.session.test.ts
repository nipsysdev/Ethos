import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrawledData, SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import {
	createMetadataTracker,
	StoppedReason,
} from "@/crawlers/MetadataTracker.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

// Create mock MetadataStore instance
const mockCreateSession = vi.fn();
const mockUpdateSession = vi.fn();
const mockGetSession = vi.fn();
const mockEndSession = vi.fn();
const mockCheckpoint = vi.fn();
const mockGetSessionContents = vi.fn();

const mockMetadataStore: Partial<MetadataStore> = {
	createSession: mockCreateSession,
	updateSession: mockUpdateSession,
	getSession: mockGetSession,
	endSession: mockEndSession,
	checkpoint: mockCheckpoint,
	getSessionContents: mockGetSessionContents,
};

describe("MetadataTracker - Session Management", () => {
	let metadataTracker: import("@/crawlers/MetadataTracker").MetadataTracker;
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
		mockGetSessionContents.mockClear();

		// Set up default return values
		mockGetSessionContents.mockReturnValue([]);

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
			content: {
				container_selector: ".article",
				fields: {
					summary: { selector: ".summary", attribute: "text", optional: true },
				},
			},
		};

		// Pass the mock MetadataStore to the constructor
		metadataTracker = createMetadataTracker(
			mockConfig,
			startTime,
			mockMetadataStore as MetadataStore,
		);
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
				crawledAt: new Date(),
				source: "test-source",
				content: "Test content 1",
				metadata: {},
			},
			{
				url: "https://example.com/article2",
				title: "Article 2",
				publishedDate: "2024-01-03", // Newer
				crawledAt: new Date(),
				source: "test-source",
				content: "Test content 2",
				metadata: {},
			},
			{
				url: "https://example.com/article3",
				title: "Article 3",
				publishedDate: "2024-01-02",
				crawledAt: new Date(),
				source: "test-source",
				content: "Test content 3",
				metadata: {},
			},
		];

		metadataTracker.addItems(mockItems);
		metadataTracker.incrementPagesProcessed();
		metadataTracker.addDuplicatesSkipped(1);
		metadataTracker.setStoppedReason(StoppedReason.NO_NEXT_BUTTON);

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

	describe("Checkpoint Management", () => {
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
