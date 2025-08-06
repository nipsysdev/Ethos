import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
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

describe("MetadataTracker - Basic Functionality", () => {
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
			content: {
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
		expect(metadata.listingErrors).toEqual([
			"Missing title",
			"Invalid URL",
			"Missing date",
		]);
	});

	it("should track content crawled", () => {
		metadataTracker.addContentsCrawled(5);
		metadataTracker.addContentsCrawled(3);

		const metadata = metadataTracker.getMetadata();
		expect(metadata.contentsCrawled).toBe(8);
	});

	it("should set stopped reason", () => {
		metadataTracker.setStoppedReason("max_pages");

		const metadata = metadataTracker.getMetadata();
		expect(metadata.stoppedReason).toBe("max_pages");
	});
});
