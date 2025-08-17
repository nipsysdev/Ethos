import { beforeEach, describe, expect, it } from "vitest";
import type { CrawlMetadata } from "@/core/types";
import { buildCrawlSummary } from "@/utils/summaryBuilder.js";

describe("Summary Builder", () => {
	let mockMetadata: CrawlMetadata;
	let mockSessionData: {
		sourceId: string;
		sourceName: string;
		startTime: Date;
		endTime?: Date | null;
		sessionId: string;
	};

	beforeEach(() => {
		mockSessionData = {
			sourceId: "test-source",
			sourceName: "Test Source",
			startTime: new Date("2025-01-01T10:00:00Z"),
			endTime: new Date("2025-01-01T10:01:00Z"),
			sessionId: "session-123",
		};

		mockMetadata = {
			duplicatesSkipped: 2,
			urlsExcluded: 1,
			totalFilteredItems: 3,
			itemsProcessed: 10,
			pagesProcessed: 5,
			contentsCrawled: 8,
			fieldStats: [
				{
					fieldName: "title",
					successCount: 9,
					totalAttempts: 10,
					isOptional: false,
					missingItems: [3],
				},
			],
			contentFieldStats: [
				{
					fieldName: "content",
					successCount: 7,
					totalAttempts: 8,
					isOptional: false,
					missingItems: [2],
				},
			],
			listingErrors: ["Error 1"],
			contentErrors: ["Error 2", "Error 3"],
			stoppedReason: "max_pages",
		};
	});

	it("should build summary with default itemsWithErrors calculation", () => {
		const summary = buildCrawlSummary(mockSessionData, mockMetadata);

		expect(summary).toEqual({
			sourceId: "test-source",
			sourceName: "Test Source",
			itemsFound: 15, // itemsProcessed (10) + duplicatesSkipped (2) + totalFilteredItems (3)
			itemsProcessed: 10,
			itemsWithErrors: 3, // listingErrors (1) + contentErrors (2)
			fieldStats: mockMetadata.fieldStats,
			contentFieldStats: mockMetadata.contentFieldStats,
			listingErrors: ["Error 1"],
			startTime: mockSessionData.startTime,
			endTime: mockSessionData.endTime,
			pagesProcessed: 5,
			duplicatesSkipped: 2,
			urlsExcluded: 1,
			stoppedReason: "max_pages",
			contentsCrawled: 8,
			contentErrors: ["Error 2", "Error 3"],
			sessionId: "session-123",
			storageStats: undefined,
		});
	});

	it("should use overridden itemsWithErrors when provided", () => {
		const summary = buildCrawlSummary(mockSessionData, mockMetadata, {
			itemsWithErrors: 5,
		});

		expect(summary.itemsWithErrors).toBe(5);
	});

	it("should include storage stats when provided", () => {
		const storageStats = {
			itemsStored: 8,
			itemsFailed: 2,
			totalItems: 10,
		};

		const summary = buildCrawlSummary(mockSessionData, mockMetadata, {
			storageStats,
		});

		expect(summary.storageStats).toEqual(storageStats);
	});

	it("should use current date as endTime when session endTime is null", () => {
		const sessionWithoutEndTime = {
			...mockSessionData,
			endTime: null,
		};

		const beforeCall = new Date();
		const summary = buildCrawlSummary(sessionWithoutEndTime, mockMetadata);
		const afterCall = new Date();

		expect(summary.endTime.getTime()).toBeGreaterThanOrEqual(
			beforeCall.getTime(),
		);
		expect(summary.endTime.getTime()).toBeLessThanOrEqual(afterCall.getTime());
	});

	it("should handle all optional fields correctly", () => {
		const minimalMetadata: CrawlMetadata = {
			duplicatesSkipped: 0,
			urlsExcluded: 0,
			totalFilteredItems: 0,
			itemsProcessed: 5,
			pagesProcessed: 1,
			contentsCrawled: 4,
			fieldStats: [],
			contentFieldStats: [],
			listingErrors: [],
			contentErrors: [],
			stoppedReason: undefined,
		};

		const summary = buildCrawlSummary(mockSessionData, minimalMetadata);

		expect(summary.itemsFound).toBe(5);
		expect(summary.itemsWithErrors).toBe(0);
		expect(summary.stoppedReason).toBeUndefined();
		expect(summary.urlsExcluded).toBe(0);
	});
});
