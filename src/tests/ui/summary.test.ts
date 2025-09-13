import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessingSummaryResult } from "@/core/ProcessingPipeline";
import { displayCrawlSummary } from "@/ui/summary";

const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Summary Display", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockResult = (overrides = {}): ProcessingSummaryResult => ({
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
			contentFieldStats: [],
			listingErrors: ["Failed to parse item 3"],
			startTime: new Date("2025-01-01T10:00:00Z"),
			endTime: new Date("2025-01-01T10:00:05Z"),
		},
		...overrides,
	});

	it("should display summary with field stats and percentages", () => {
		const result = createMockResult();
		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("Summary:");
		expect(mockLog).toHaveBeenCalledWith("  Source: Test Source (test-source)");
		expect(mockLog).toHaveBeenCalledWith("  Items found: 10");
		expect(mockLog).toHaveBeenCalledWith("  Items successfully retrieved: 8");
		expect(mockLog).toHaveBeenCalledWith("  Items with errors: 2");
		expect(mockLog).toHaveBeenCalledWith("  title: 8/8 (100.00%)");
		expect(mockLog).toHaveBeenCalledWith("  author: 6/8 (75.00%)");
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

		expect(mockLog).toHaveBeenCalledWith("  empty: 0/0 (0%) (optional)");
		// Issues section has been moved to the error viewer, so no longer displayed in summary
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

		expect(mockLog).toHaveBeenCalledWith("\nCrawl took: 1.5 seconds");
	});

	it("should display content crawling stats when available", () => {
		const result = createMockResult({
			summary: {
				...createMockResult().summary,
				pagesProcessed: 3,
				duplicatesSkipped: 2,
				stoppedReason: "max_pages" as const,
				contentsCrawled: 6,
				contentFieldStats: [
					{
						fieldName: "content",
						successCount: 5,
						totalAttempts: 6,
						isOptional: true,
						missingItems: [4],
					},
					{
						fieldName: "author",
						successCount: 6,
						totalAttempts: 6,
						isOptional: true,
						missingItems: [],
					},
				],
			},
		});

		displayCrawlSummary(result);

		expect(mockLog).toHaveBeenCalledWith("  Listing pages processed: 3");
		expect(mockLog).toHaveBeenCalledWith("  Duplicates skipped: 2");
		expect(mockLog).toHaveBeenCalledWith(
			"  Stop reason: reached maximum pages limit",
		);
		expect(mockLog).toHaveBeenCalledWith("\nContent field extraction stats:");
		expect(mockLog).toHaveBeenCalledWith("  content: 5/6 (83.33%)");
		expect(mockLog).toHaveBeenCalledWith("  author: 6/6 (100.00%)");
	});

	it("should show content extraction errors when present", () => {
		const result = createMockResult({
			summary: {
				...createMockResult().summary,
				contentErrors: [
					"Content extraction for https://example.com/1: Failed to extract content",
					"Failed to load content page https://example.com/2: Navigation timeout",
					"Content extraction for https://example.com/3: Parser error",
					"Content extraction for https://example.com/4: Network error",
				],
			},
		});

		displayCrawlSummary(result);

		// Content extraction errors are no longer displayed in summary, moved to error viewer
		expect(mockLog).not.toHaveBeenCalledWith("\nIssues found:");
		expect(mockLog).not.toHaveBeenCalledWith("   Content extraction issues:");
	});

	it("should handle all stop reasons correctly", () => {
		const testCases = [
			{
				reason: "no_next_button" as const,
				expected: "no more pages available",
			},
			{
				reason: "all_duplicates" as const,
				expected: "all items on page were already crawled",
			},
			{ reason: "max_pages" as const, expected: "reached maximum pages limit" },
			{
				reason: "process_interrupted" as const,
				expected: "process was interrupted",
			},
		];

		testCases.forEach(({ reason, expected }) => {
			vi.clearAllMocks();
			const result = createMockResult({
				summary: {
					...createMockResult().summary,
					pagesProcessed: 2,
					stoppedReason: reason,
				},
			});

			displayCrawlSummary(result);

			expect(mockLog).toHaveBeenCalledWith(`  Stop reason: ${expected}`);
		});
	});
});
