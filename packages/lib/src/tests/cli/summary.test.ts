import { beforeEach, describe, expect, it, vi } from "vitest";
import { displayCrawlSummary } from "../../cli/ui/summary.js";
import type { ProcessingResult } from "../../index.js";

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
					fieldName: "author",
					successCount: 6,
					totalAttempts: 8,
					isOptional: false,
					missingItems: [3, 7],
				},
			],
			errors: ["Failed to parse item 3"],
			startTime: new Date("2025-01-01T10:00:00Z"),
			endTime: new Date("2025-01-01T10:00:05Z"),
		},
		...overrides,
	});

	it("should display summary with field stats and percentages", () => {
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
		expect(mockLog).toHaveBeenCalledWith("   • title: 8/8 (100%)");
		expect(mockLog).toHaveBeenCalledWith("   • author: 6/8 (75%)");
	});

	it("should handle zero attempts and show missing field issues", () => {
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
		expect(mockLog).toHaveBeenCalledWith("\n⚠️  Issues found:");
	});

	it("should calculate and display duration correctly", () => {
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
