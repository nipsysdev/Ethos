import { describe, expect, it, vi } from "vitest";
import type { ProcessingSummaryResult } from "@/core/ProcessingPipeline";

// Mock inquirer
const mockPrompt = vi.fn();
vi.mock("inquirer", () => ({
	default: {
		prompt: mockPrompt,
	},
}));

describe("menus module", () => {
	it("should export showPostCrawlMenu function", async () => {
		const { showPostCrawlMenu } = await import("../../ui/menus.js");
		expect(typeof showPostCrawlMenu).toBe("function");
	});

	it("should show error menu option when there are errors", async () => {
		const { showPostCrawlMenu } = await import("../../ui/menus.js");

		const mockResult: ProcessingSummaryResult = {
			summary: {
				sourceId: "test",
				sourceName: "Test Source",
				itemsFound: 10,
				itemsProcessed: 8,
				itemsWithErrors: 2,
				fieldStats: [
					{
						fieldName: "title",
						successCount: 8,
						totalAttempts: 10,
						isOptional: false,
						missingItems: [1, 2],
					},
				],
				contentFieldStats: [],
				listingErrors: ["Error 1"],
				contentErrors: ["Error 2"],
				startTime: new Date(),
				endTime: new Date(),
			},
		};

		mockPrompt.mockResolvedValue({ action: "view" });

		await showPostCrawlMenu(mockResult);

		expect(mockPrompt).toHaveBeenCalledWith([
			{
				type: "list",
				name: "action",
				message: "What would you like to do next:",
				choices: expect.arrayContaining([
					expect.objectContaining({
						name: "View crawling errors (2)",
						value: "errors",
					}),
				]),
			},
		]);
	});

	it("should not show error menu option when there are no errors", async () => {
		const { showPostCrawlMenu } = await import("../../ui/menus.js");

		const mockResult: ProcessingSummaryResult = {
			summary: {
				sourceId: "test",
				sourceName: "Test Source",
				itemsFound: 10,
				itemsProcessed: 10,
				itemsWithErrors: 0,
				fieldStats: [
					{
						fieldName: "title",
						successCount: 10,
						totalAttempts: 10,
						isOptional: false,
						missingItems: [],
					},
				],
				contentFieldStats: [],
				listingErrors: [],
				contentErrors: [],
				startTime: new Date(),
				endTime: new Date(),
			},
		};

		mockPrompt.mockResolvedValue({ action: "view" });

		await showPostCrawlMenu(mockResult);

		expect(mockPrompt).toHaveBeenCalledWith([
			{
				type: "list",
				name: "action",
				message: "What would you like to do next:",
				choices: expect.not.arrayContaining([
					expect.objectContaining({
						value: "errors",
					}),
				]),
			},
		]);
	});
});
