import { beforeEach, describe, expect, it, vi } from "vitest";
import { showExtractedData } from "../../cli/ui/viewer.js";
import type { ProcessingResult } from "../../index.js";

// Mock child_process
vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

// Mock os
vi.mock("node:os", () => ({
	tmpdir: () => "/tmp",
}));

const mockSpawn = vi.mocked((await import("node:child_process")).spawn);
const mockWriteFileSync = vi.mocked((await import("node:fs")).writeFileSync);
const mockUnlinkSync = vi.mocked((await import("node:fs")).unlinkSync);

// Mock console.log and console.error
const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

describe("Data Viewer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockResult = (): ProcessingResult => ({
		data: [
			{
				url: "https://example.com/article1",
				timestamp: new Date("2025-01-01T10:00:01Z"),
				source: "test-source",
				title: "Test Article",
				content: "Test content",
				metadata: {},
				analysis: [],
			},
		],
		summary: {
			sourceId: "test-source",
			sourceName: "Test Source",
			itemsFound: 1,
			itemsProcessed: 1,
			itemsWithErrors: 0,
			fieldStats: [],
			errors: [],
			startTime: new Date("2025-01-01T10:00:00Z"),
			endTime: new Date("2025-01-01T10:00:05Z"),
		},
	});

	it("should display message when no data exists", async () => {
		const result = createMockResult();
		result.data = [];

		await showExtractedData(result);

		expect(mockLog).toHaveBeenCalledWith("No data to display.");
		expect(mockWriteFileSync).not.toHaveBeenCalled();
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("should create temp file and spawn less successfully", async () => {
		const result = createMockResult();

		// Mock which command to return success (less is available)
		const mockWhichProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") {
					callback(0); // Success - less is available
				}
			}),
		};

		// Mock successful less process
		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") {
					// Simulate successful exit
					callback(0);
				}
			}),
		};

		// First call is for 'which less', second is for 'less'
		mockSpawn
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
			.mockReturnValueOnce(mockWhichProcess as any)
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
			.mockReturnValueOnce(mockLessProcess as any);

		await showExtractedData(result);

		// Should create temp file
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			expect.stringMatching(/\/tmp\/ethos-crawl-[\w-]+\.txt$/),
			expect.stringContaining("EXTRACTED DATA - Test Source"),
			"utf8",
		);

		// Should spawn less
		expect(mockSpawn).toHaveBeenCalledWith(
			"less",
			["-R", expect.stringMatching(/\/tmp\/ethos-crawl-[\w-]+\.txt$/)],
			{ stdio: "inherit" },
		);

		// Should cleanup temp file
		expect(mockUnlinkSync).toHaveBeenCalledWith(
			expect.stringMatching(/\/tmp\/ethos-crawl-[\w-]+\.txt$/),
		);
	});

	it("should handle less error by displaying data directly", async () => {
		const result = createMockResult();

		// Mock which command to return success (less is available)
		const mockWhichProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") {
					callback(0); // Success - less is available
				}
			}),
		};

		// Mock less process with error
		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "error") {
					callback(new Error("less not found"));
				}
			}),
		};

		// First call is for 'which less', second is for 'less'
		mockSpawn
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
			.mockReturnValueOnce(mockWhichProcess as any)
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
			.mockReturnValueOnce(mockLessProcess as any);

		await showExtractedData(result);

		expect(mockError).toHaveBeenCalledWith(
			"Error opening less viewer:",
			"less not found",
		);
		expect(mockLog).toHaveBeenCalledWith("Displaying data directly:");
		expect(mockLog).toHaveBeenCalledWith(
			expect.stringContaining("EXTRACTED DATA - Test Source"),
		);
	});

	it("should handle less non-zero exit code", async () => {
		const result = createMockResult();

		// Mock less process with non-zero exit
		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") {
					callback(1); // Non-zero exit code
				}
			}),
		};
		// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
		mockSpawn.mockReturnValue(mockLessProcess as any);

		// This should reject the promise, but our implementation catches it
		// and handles it gracefully, so the function should still complete
		await expect(showExtractedData(result)).resolves.toBeUndefined();
	});

	it("should handle file write error gracefully", async () => {
		const result = createMockResult();

		// Mock writeFileSync to throw
		mockWriteFileSync.mockImplementation(() => {
			throw new Error("Permission denied");
		});

		await showExtractedData(result);

		expect(mockError).toHaveBeenCalledWith(
			"Could not create temp file:",
			"Permission denied",
		);
		expect(mockLog).toHaveBeenCalledWith("Displaying data directly:");
		expect(mockLog).toHaveBeenCalledWith(
			expect.stringContaining("EXTRACTED DATA - Test Source"),
		);
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("should handle temp file cleanup error gracefully", async () => {
		const result = createMockResult();

		// Mock successful less process
		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") {
					callback(0);
				}
			}),
		};
		// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
		mockSpawn.mockReturnValue(mockLessProcess as any);

		// Mock unlinkSync to throw
		mockUnlinkSync.mockImplementation(() => {
			throw new Error("File not found");
		});

		// Should not throw error
		await expect(showExtractedData(result)).resolves.toBeUndefined();
	});

	it("should use formatted data from formatter", async () => {
		const result = createMockResult();

		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") {
					callback(0);
				}
			}),
		};
		// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
		mockSpawn.mockReturnValue(mockLessProcess as any);

		await showExtractedData(result);

		const writtenContent = mockWriteFileSync.mock.calls[0][1];
		expect(writtenContent).toContain(
			"EXTRACTED DATA - Test Source (test-source)",
		);
		expect(writtenContent).toContain("--- Item 1 of 1 ---");
		expect(writtenContent).toContain("Title: Test Article");
		expect(writtenContent).toContain("End of data");
	});
});
