import { beforeEach, describe, expect, it, vi } from "vitest";
import { showExtractedData } from "../../cli/ui/viewer.js";
import type { ProcessingResult } from "../../index.js";

// Mock child_process, fs, and os
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs", () => ({ writeFileSync: vi.fn(), unlinkSync: vi.fn() }));
vi.mock("node:os", () => ({ tmpdir: () => "/tmp" }));

const mockSpawn = vi.mocked((await import("node:child_process")).spawn);
const mockWriteFileSync = vi.mocked((await import("node:fs")).writeFileSync);
const mockUnlinkSync = vi.mocked((await import("node:fs")).unlinkSync);
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
			listingErrors: [],
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
	});

	it("should create temp file and spawn less successfully", async () => {
		const result = createMockResult();

		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") callback(0);
			}),
		};

		// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
		mockSpawn.mockReturnValue(mockLessProcess as any);

		await showExtractedData(result);

		expect(mockWriteFileSync).toHaveBeenCalledWith(
			expect.stringMatching(/\/tmp\/ethos-crawl-[\w-]+\.txt$/),
			expect.stringContaining("EXTRACTED DATA - Test Source"),
			"utf8",
		);
		expect(mockUnlinkSync).toHaveBeenCalled();
	});

	it("should handle file system errors gracefully", async () => {
		const result = createMockResult();

		mockWriteFileSync.mockImplementation(() => {
			throw new Error("Permission denied");
		});

		await showExtractedData(result);

		expect(mockError).toHaveBeenCalledWith(
			"Could not create temp file:",
			"Permission denied",
		);
		expect(mockLog).toHaveBeenCalledWith("Displaying data directly:");
		expect(mockSpawn).not.toHaveBeenCalled();
	});
});
