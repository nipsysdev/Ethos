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

describe("MetadataTracker - Items Processing", () => {
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
});
