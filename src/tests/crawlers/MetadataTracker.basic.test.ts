import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
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
const mockAddSessionErrors = vi.fn();

const mockMetadataStore: Partial<MetadataStore> = {
	createSession: mockCreateSession,
	updateSession: mockUpdateSession,
	getSession: mockGetSession,
	endSession: mockEndSession,
	checkpoint: mockCheckpoint,
	getSessionContents: mockGetSessionContents,
	addSessionErrors: mockAddSessionErrors,
};

describe("MetadataTracker - Basic Functionality", () => {
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
		mockAddSessionErrors.mockClear();

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

	it("should initialize metadata correctly", () => {
		const metadata = metadataTracker.getMetadata();

		expect(metadata.itemsProcessed).toBe(0);
		expect(metadata.duplicatesSkipped).toBe(0);
		expect(metadata.totalFilteredItems).toBe(0);
		expect(metadata.pagesProcessed).toBe(0);
		expect(metadata.contentsCrawled).toBe(0);
		expect(metadata.fieldStats).toHaveLength(3); // title, url, publishedDate
		expect(metadata.contentFieldStats).toHaveLength(1); // summary
		expect(metadata.listingErrors).toEqual([]);
		expect(metadata.contentErrors).toEqual([]);
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
		// Errors are now stored directly in database, not in memory
		expect(metadata.listingErrors).toEqual([]);

		// Verify database storage method was called correctly
		expect(mockAddSessionErrors).toHaveBeenCalledTimes(2);
		expect(mockAddSessionErrors).toHaveBeenNthCalledWith(
			1,
			expect.any(String),
			"listing",
			["Missing title", "Invalid URL"],
		);
		expect(mockAddSessionErrors).toHaveBeenNthCalledWith(
			2,
			expect.any(String),
			"listing",
			["Missing date"],
		);
	});

	it("should track content crawled", () => {
		metadataTracker.addContentsCrawled(5);
		metadataTracker.addContentsCrawled(3);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.contentsCrawled).toBe(8);
	});

	it("should track content errors", () => {
		metadataTracker.addContentErrors([
			"Content extraction failed for https://example.com/1: Failed to extract content",
			"Failed to load content page https://example.com/2: Navigation timeout",
		]);
		metadataTracker.addContentErrors(["Another content error"]);

		const metadata = metadataTracker.getMetadata();
		// Errors are now stored directly in database, not in memory
		expect(metadata.contentErrors).toEqual([]);

		// Verify database storage method was called correctly
		expect(mockAddSessionErrors).toHaveBeenCalledTimes(2);
		expect(mockAddSessionErrors).toHaveBeenNthCalledWith(
			1,
			expect.any(String),
			"content",
			[
				"Content extraction failed for https://example.com/1: Failed to extract content",
				"Failed to load content page https://example.com/2: Navigation timeout",
			],
		);
		expect(mockAddSessionErrors).toHaveBeenNthCalledWith(
			2,
			expect.any(String),
			"content",
			["Another content error"],
		);
	});

	it("should track field extraction warnings", () => {
		metadataTracker.addFieldExtractionWarnings([
			"Optional field 'author' not found for \"Test Article\"",
			"Content extraction warning: element not found",
		]);

		const metadata = metadataTracker.getMetadata();
		// Errors are now stored directly in database, not in memory
		expect(metadata.listingErrors).toEqual([]);
		expect(metadata.contentErrors).toEqual([]);

		// Verify database storage method was called correctly
		expect(mockAddSessionErrors).toHaveBeenCalledTimes(2); // Once for listing, once for content
		expect(mockAddSessionErrors).toHaveBeenNthCalledWith(
			1,
			expect.any(String),
			"listing",
			["Optional field 'author' not found for \"Test Article\""],
		);
		expect(mockAddSessionErrors).toHaveBeenNthCalledWith(
			2,
			expect.any(String),
			"content",
			["Content extraction warning: element not found"],
		);
	});

	it("should set stopped reason", () => {
		metadataTracker.setStoppedReason(StoppedReason.MAX_PAGES);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.stoppedReason).toBe("max_pages");
	});
});
