import { beforeEach, describe, expect, it, vi } from "vitest";
import { displayResults, showPostCrawlMenuWithFlow } from "@/cli/ui/display.js";
import type { ProcessingSummaryResult } from "@/index.js";

// Mock inquirer and other dependencies
vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn(),
	},
}));

vi.mock("@/cli/ui/menus.js", () => ({
	showPostCrawlMenu: vi.fn(),
}));

vi.mock("@/cli/ui/viewer.js", () => ({
	showExtractedData: vi.fn(),
}));

const mockShowPostCrawlMenu = vi.mocked(
	(await import("@/cli/ui/menus.js")).showPostCrawlMenu,
);
const mockShowExtractedData = vi.mocked(
	(await import("@/cli/ui/viewer.js")).showExtractedData,
);

describe("display module", () => {
	const mockResult: ProcessingSummaryResult = {
		summary: {
			sourceName: "test",
			sourceId: "test-id",
			startTime: new Date(),
			endTime: new Date(),
			itemsFound: 0,
			itemsProcessed: 0,
			itemsWithErrors: 0,
			fieldStats: [],
			contentFieldStats: [],
			listingErrors: [],
		},
	};

	it("should call displayResults without throwing", () => {
		// Mock console.log to avoid noise in test output
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		expect(() => displayResults(mockResult)).not.toThrow();

		consoleSpy.mockRestore();
	});

	describe("showPostCrawlMenuWithFlow", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("should return action directly when not viewing", async () => {
			mockShowPostCrawlMenu.mockResolvedValue("exit");

			const result = await showPostCrawlMenuWithFlow(mockResult);

			expect(result).toBe("exit");
			expect(mockShowPostCrawlMenu).toHaveBeenCalledTimes(1);
			expect(mockShowExtractedData).not.toHaveBeenCalled();
		});

		it("should show viewer and loop back to menu when view is selected", async () => {
			mockShowPostCrawlMenu
				.mockResolvedValueOnce("view")
				.mockResolvedValueOnce("main");

			const result = await showPostCrawlMenuWithFlow(mockResult);

			expect(result).toBe("main");
			expect(mockShowPostCrawlMenu).toHaveBeenCalledTimes(2);
			expect(mockShowExtractedData).toHaveBeenCalledTimes(1);
			expect(mockShowExtractedData).toHaveBeenCalledWith(mockResult);
		});

		it("should handle user selection to exit", async () => {
			mockShowPostCrawlMenu.mockResolvedValue("exit");

			const result = await showPostCrawlMenuWithFlow(mockResult);

			expect(result).toBe("exit");
			expect(mockShowPostCrawlMenu).toHaveBeenCalledTimes(1);
		});

		it("should handle errors in post-crawl menu flow", async () => {
			mockShowPostCrawlMenu.mockRejectedValue(new Error("Test error"));

			await expect(showPostCrawlMenuWithFlow(mockResult)).rejects.toThrow(
				"Test error",
			);
		});
	});
});
