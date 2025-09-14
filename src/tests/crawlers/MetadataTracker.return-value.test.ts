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

describe("MetadataTracker - Return Values", () => {
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

	it("should return MetadataState from addItems method", () => {
		const result = metadataTracker.addItems([]);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});

	it("should return MetadataState from incrementPagesProcessed method", () => {
		const result = metadataTracker.incrementPagesProcessed();

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});

	it("should return MetadataState from addDuplicatesSkipped method", () => {
		const result = metadataTracker.addDuplicatesSkipped(1);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});

	it("should return MetadataState from addUrlsExcluded method", () => {
		const result = metadataTracker.addUrlsExcluded(1);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});

	it("should return MetadataState from addFilteredItems method", () => {
		const result = metadataTracker.addFilteredItems(1, ["test reason"]);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});

	it("should return MetadataState from addContentsCrawled method", () => {
		const result = metadataTracker.addContentsCrawled(1);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});

	it("should return MetadataState from setStoppedReason method", () => {
		const result = metadataTracker.setStoppedReason(StoppedReason.MAX_PAGES);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("sessionId");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("contentLinkedCount");
		expect(typeof result.sessionId).toBe("string");
		expect(typeof result.contentLinkedCount).toBe("number");
		expect(result.metadata).toBeDefined();
	});
});
