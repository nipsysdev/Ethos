import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showExtractedData } from "@/cli/ui/viewer.js";
import type { ProcessingResult } from "@/index.js";

// Mock child_process and inquirer
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn(),
	},
}));

const mockSpawn = vi.mocked((await import("node:child_process")).spawn);
const mockInquirer = vi.mocked((await import("inquirer")).default);
const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Data Viewer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockResult = (withTempFile = true): ProcessingResult => {
		let tempMetadataFile: string | undefined;

		if (withTempFile) {
			// Create a temp file with mock metadata
			tempMetadataFile = join(tmpdir(), `test-crawl-${Date.now()}.json`);
			const mockMetadata = {
				itemsForViewer: [
					{
						url: "https://example.com/article1",
						title: "Test Article",
						hash: "abc123",
					},
				],
			};
			writeFileSync(tempMetadataFile, JSON.stringify(mockMetadata));
		}

		return {
			data: [], // Empty since items are now processed immediately
			summary: {
				sourceId: "test-source",
				sourceName: "Test Source",
				itemsFound: 1,
				itemsProcessed: 1,
				itemsWithErrors: 0,
				fieldStats: [],
				detailFieldStats: [],
				listingErrors: [],
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:00:05Z"),
				tempMetadataFile,
			},
		};
	};

	it("should display message when no crawl metadata available", async () => {
		const result = createMockResult(false); // Don't create temp file

		await showExtractedData(result);

		expect(mockLog).toHaveBeenCalledWith(
			"No crawl metadata available for viewing.",
		);
		expect(mockInquirer.prompt).not.toHaveBeenCalled();
	});

	it("should show file selection menu and open file with less", async () => {
		const result = createMockResult();
		let actualSelectedFile = "";

		// Capture the actual file path from inquirer choices
		mockInquirer.prompt
			.mockImplementationOnce(async (questions) => {
				const questionArray = Array.isArray(questions)
					? questions
					: [questions];
				const question = questionArray[0] as {
					choices: Array<{ value: string; name: string }>;
				};
				actualSelectedFile = question.choices[0].value; // Get the actual file path
				return { selectedFile: actualSelectedFile };
			})
			.mockResolvedValueOnce({
				selectedFile: "back", // This will exit the loop
			});

		// Mock less process
		const mockLessProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") callback(0);
			}),
		};

		// Mock 'which less' command to indicate less is available
		const mockWhichProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") callback(0); // less is available
			}),
		};

		mockSpawn
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
			.mockReturnValueOnce(mockWhichProcess as any) // which/where command
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
			.mockReturnValueOnce(mockLessProcess as any); // less command

		await showExtractedData(result);

		// Verify inquirer was called with the correct structure
		expect(mockInquirer.prompt).toHaveBeenCalledWith([
			expect.objectContaining({
				type: "list",
				name: "selectedFile",
				message: "Select an item to view (1 files):",
				choices: expect.arrayContaining([
					expect.objectContaining({
						name: "1. Test Article",
						short: "Test Article",
					}),
					expect.objectContaining({
						name: "← Back to menu",
						value: "back",
						short: "Back",
					}),
				]),
				pageSize: 15,
			}),
		]);

		// Verify less was called with the actual file path
		expect(actualSelectedFile).toContain("abc123.json");
		expect(mockSpawn).toHaveBeenCalledWith("less", ["-R", actualSelectedFile], {
			stdio: "inherit",
		});

		// Cleanup temp file
		if (result.summary.tempMetadataFile) {
			unlinkSync(result.summary.tempMetadataFile);
		}
	});

	it("should handle when less is not available", async () => {
		const result = createMockResult();
		let actualSelectedFile = "";

		mockInquirer.prompt
			.mockImplementationOnce(async (questions) => {
				const questionArray = Array.isArray(questions)
					? questions
					: [questions];
				const question = questionArray[0] as {
					choices: Array<{ value: string; name: string }>;
				};
				actualSelectedFile = question.choices[0].value; // Get the actual file path
				return { selectedFile: actualSelectedFile };
			})
			.mockResolvedValueOnce({
				selectedFile: "back", // Exit after showing the message
			});

		// Mock 'which less' command to indicate less is NOT available
		const mockWhichProcess = {
			on: vi.fn((event, callback) => {
				if (event === "close") callback(1); // less not found
			}),
		};

		// biome-ignore lint/suspicious/noExplicitAny: vitest mock compatibility
		mockSpawn.mockReturnValueOnce(mockWhichProcess as any);

		await showExtractedData(result);

		expect(mockLog).toHaveBeenCalledWith(
			"Less viewer not available. Please install 'less' to view files.",
		);
		expect(mockLog).toHaveBeenCalledWith(
			`File location: ${actualSelectedFile}`,
		);

		// Cleanup temp file
		if (result.summary.tempMetadataFile) {
			unlinkSync(result.summary.tempMetadataFile);
		}
	});

	it("should handle back option", async () => {
		const result = createMockResult();

		mockInquirer.prompt.mockResolvedValueOnce({
			selectedFile: "back",
		});

		await showExtractedData(result);

		expect(mockInquirer.prompt).toHaveBeenCalledTimes(1);
		expect(mockSpawn).not.toHaveBeenCalled();

		// Cleanup temp file
		if (result.summary.tempMetadataFile) {
			unlinkSync(result.summary.tempMetadataFile);
		}
	});
});
