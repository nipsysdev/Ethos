import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { displayResults, showPostCrawlMenuWithFlow } from "@/cli/ui/display.js";
import type { ProcessingResult } from "@/index.js";

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

// Mock the CommonJS require for the cleanup function
const mockUnregisterTempFile = vi.fn();
vi.doMock("@/cli/index.js", () => ({
	unregisterTempFile: mockUnregisterTempFile,
}));

const mockShowPostCrawlMenu = vi.mocked(
	(await import("@/cli/ui/menus.js")).showPostCrawlMenu,
);
const mockShowExtractedData = vi.mocked(
	(await import("@/cli/ui/viewer.js")).showExtractedData,
);

describe("display module", () => {
	const mockResult: ProcessingResult = {
		data: [],
		summary: {
			sourceName: "test",
			sourceId: "test-id",
			startTime: new Date(),
			endTime: new Date(),
			itemsFound: 0,
			itemsProcessed: 0,
			itemsWithErrors: 0,
			fieldStats: [],
			detailFieldStats: [],
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

		it("should cleanup temp metadata file when exiting context", async () => {
			const tempFile = join(tmpdir(), `test-cleanup-${Date.now()}.json`);
			writeFileSync(tempFile, "{}");

			const resultWithTempFile: ProcessingResult = {
				...mockResult,
				summary: {
					...mockResult.summary,
					tempMetadataFile: tempFile,
				},
			};

			mockShowPostCrawlMenu.mockResolvedValue("exit");
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await showPostCrawlMenuWithFlow(resultWithTempFile);

			expect(result).toBe("exit");
			expect(consoleSpy).toHaveBeenCalledWith(
				"🗑️  Cleaned up temporary metadata file",
			);

			consoleSpy.mockRestore();
		});

		it("should cleanup temp file on error", async () => {
			const tempFile = join(tmpdir(), `test-cleanup-error-${Date.now()}.json`);
			writeFileSync(tempFile, "{}");

			const resultWithTempFile: ProcessingResult = {
				...mockResult,
				summary: {
					...mockResult.summary,
					tempMetadataFile: tempFile,
				},
			};

			mockShowPostCrawlMenu.mockRejectedValue(new Error("Test error"));
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			await expect(
				showPostCrawlMenuWithFlow(resultWithTempFile),
			).rejects.toThrow("Test error");

			expect(consoleSpy).toHaveBeenCalledWith(
				"🗑️  Cleaned up temporary metadata file",
			);

			consoleSpy.mockRestore();
		});

		it("should handle cleanup when temp file does not exist", async () => {
			const nonExistentFile = join(tmpdir(), `non-existent-${Date.now()}.json`);

			const resultWithTempFile: ProcessingResult = {
				...mockResult,
				summary: {
					...mockResult.summary,
					tempMetadataFile: nonExistentFile,
				},
			};

			mockShowPostCrawlMenu.mockResolvedValue("exit");
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await showPostCrawlMenuWithFlow(resultWithTempFile);

			expect(result).toBe("exit");
			// Should not log cleanup message if file doesn't exist (unlinkSync fails)
			expect(consoleSpy).not.toHaveBeenCalledWith(
				"🗑️  Cleaned up temporary metadata file",
			);

			consoleSpy.mockRestore();
		});
	});
});
