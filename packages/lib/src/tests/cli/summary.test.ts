import { beforeEach, describe, expect, it, vi } from "vitest";
import { displayCrawlSummary } from "../../cli/ui/summary.js";
import type { ProcessingResult } from "../../index.js";

// Mock console.log
const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Summary Display", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockResult = (overrides = {}): ProcessingResult => ({
		data: [],
		summary: {
			sourceId: "test-source",
			sourceName: "Test Source",
			itemsFound: 10,
			itemsProcessed: 8,
			itemsWithErrors: 2,
			fieldStats: [
				{
					fieldName: "title",
					successCount: 8,
					totalAttempts: 8,
					isOptional: false,
					missingItems: [],
				},
				{
					fieldName: "excerpt",
					successCount: 5,
					totalAttempts: 8,
					isOptional: true,
					missingItems: [2, 4, 6],
				},
				{
					fieldName: "author",
					successCount: 6,
					totalAttempts: 8,
					isOptional: false,
					missingItems: [3, 7],
				},
			],
			errors: ["Failed to parse item 3", "Network timeout on item 7"],
			startTime: new Date("2025-01-01T10:00:00Z"),
			endTime: new Date("2025-01-01T10:00:05Z"),
		},
		...overrides,
	});

	it("should display basic summary information", () => {
		const result = createMockResult();
		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("📊 Summary:");
		expect(mockLog).toHaveBeenCalledWith(
			"   • Source: Test Source (test-source)",
		);
		expect(mockLog).toHaveBeenCalledWith("   • Items found: 10");
		expect(mockLog).toHaveBeenCalledWith(
			"   • Items successfully processed: 8",
		);
		expect(mockLog).toHaveBeenCalledWith("   • Items with errors: 2");
	});

	it("should not show error count when there are no errors", () => {
		const result = createMockResult({
			summary: {
				...createMockResult().summary,
				itemsWithErrors: 0,
			},
		});

		displayCrawlSummary(result);

		expect(mockLog).not.toHaveBeenCalledWith(
			expect.stringContaining("Items with errors"),
		);
	});

	it("should display field extraction stats with percentages", () => {
		const result = createMockResult();
		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("\n📋 Field extraction stats:");
		expect(mockLog).toHaveBeenCalledWith("   • title: 8/8 (100%)");
		expect(mockLog).toHaveBeenCalledWith("   • excerpt: 5/8 (63%) (optional)");
		expect(mockLog).toHaveBeenCalledWith("   • author: 6/8 (75%)");
	});

	it("should handle zero attempts gracefully", () => {
		const result = createMockResult({
			summary: {
				...createMockResult().summary,
				fieldStats: [
					{
						fieldName: "empty",
						successCount: 0,
						totalAttempts: 0,
						isOptional: true,
						missingItems: [],
					},
				],
			},
		});

		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("   • empty: 0/0 (0%) (optional)");
	});

	it("should show issues for missing required fields", () => {
		const result = createMockResult();
		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("\n⚠️  Issues found:");
		expect(mockLog).toHaveBeenCalledWith(
			"   • 2 item(s) missing required field: author",
		);
	});

	it("should show general errors", () => {
		const result = createMockResult();
		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("   • Failed to parse item 3");
		expect(mockLog).toHaveBeenCalledWith("   • Network timeout on item 7");
	});

	it("should not show issues section when no problems exist", () => {
		const result = createMockResult({
			summary: {
				...createMockResult().summary,
				fieldStats: [
					{
						fieldName: "title",
						successCount: 8,
						totalAttempts: 8,
						isOptional: false,
						missingItems: [],
					},
				],
				errors: [],
			},
		});

		displayCrawlSummary(result);

		expect(mockLog).not.toHaveBeenCalledWith(
			expect.stringContaining("Issues found"),
		);
	});

	it("should display crawl duration", () => {
		const result = createMockResult();
		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("\n⏱️  Crawl took: 5 seconds");
	});

	it("should handle fractional durations", () => {
		const result = createMockResult({
			summary: {
				...createMockResult().summary,
				startTime: new Date("2025-01-01T10:00:00.000Z"),
				endTime: new Date("2025-01-01T10:00:01.500Z"),
			},
		});

		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("\n⏱️  Crawl took: 1.5 seconds");
	});
});
