import { beforeEach, describe, expect, it, vi } from "vitest";
import { showCrawlErrors } from "@/commands/errors";
import type { ProcessingSummaryResult } from "@/core/ProcessingPipeline";
import type { FieldExtractionStats } from "@/core/types";

// Mock fs functions
vi.mock("node:fs", () => ({
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

// Mock os and path functions
vi.mock("node:os", () => ({
	tmpdir: vi.fn(() => "/tmp"),
}));

vi.mock("node:path", () => ({
	join: vi.fn((...paths) => paths.join("/")),
}));

// Mock child_process spawn
vi.mock("node:child_process", () => ({
	spawn: vi.fn(() => ({
		on: vi.fn((event, callback) => {
			if (event === "close") {
				setTimeout(() => callback(0), 10);
			}
		}),
	})),
}));

// Mock process.stdin globally
const mockStdin = {
	once: vi.fn((event, callback) => {
		if (event === "data") {
			setTimeout(callback, 10);
		}
	}),
};

vi.stubGlobal("process", {
	...process,
	stdin: mockStdin,
});

const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Error Display", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockResultWithErrors = (
		listingErrors: string[] = [],
		contentErrors: string[] = [],
		fieldStats: FieldExtractionStats[] = [],
	): ProcessingSummaryResult => ({
		summary: {
			sourceId: "test-source",
			sourceName: "Test Source",
			itemsFound: 10,
			itemsProcessed: 8,
			itemsWithErrors: 2,
			fieldStats,
			contentFieldStats: [],
			listingErrors,
			contentErrors,
			startTime: new Date("2025-01-01T10:00:00Z"),
			endTime: new Date("2025-01-01T10:00:05Z"),
		},
	});

	it("should display 'no errors' message when there are no errors", async () => {
		const result = createMockResultWithErrors();

		await showCrawlErrors(result);

		expect(mockLog).toHaveBeenCalledWith("No errors found during crawling!");
		expect(mockLog).toHaveBeenCalledWith("Press Enter to continue...");
	});

	it("should call less with error content when errors exist", async () => {
		const { spawn } = await import("node:child_process");
		const { writeFileSync } = await import("node:fs");

		const listingErrors = ["Failed to parse item 1", "Missing required field"];
		const contentErrors = ["Content page failed to load"];
		const result = createMockResultWithErrors(listingErrors, contentErrors);

		await showCrawlErrors(result);

		expect(writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("ethos-crawl-errors-"),
			expect.stringContaining("Test Source"),
			"utf8",
		);

		expect(spawn).toHaveBeenCalledWith(
			"less",
			["-R", "-S", expect.stringContaining("ethos-crawl-errors-")],
			{ stdio: "inherit" },
		);
	});

	it("should include both listing and content errors in the generated content", async () => {
		const { writeFileSync } = await import("node:fs");

		const listingErrors = ["Listing error 1", "Listing error 2"];
		const contentErrors = ["Content error 1"];
		const result = createMockResultWithErrors(listingErrors, contentErrors);

		await showCrawlErrors(result);

		const writeFileCall = vi.mocked(writeFileSync).mock.calls[0];
		const content = writeFileCall[1] as string;

		expect(content).toContain("LISTING EXTRACTION ERRORS");
		expect(content).toContain("CONTENT EXTRACTION ERRORS");
		expect(content).toContain("Listing error 1");
		expect(content).toContain("Listing error 2");
		expect(content).toContain("Content error 1");
		expect(content).toContain("Total listing errors: 2");
		expect(content).toContain("Total content errors: 1");
		expect(content).toContain("Total errors: 3");
	});

	it("should include field extraction issues in the error report", async () => {
		const { writeFileSync } = await import("node:fs");

		const fieldStats: FieldExtractionStats[] = [
			{
				fieldName: "title",
				successCount: 8,
				totalAttempts: 10,
				isOptional: false,
				missingItems: [3, 7],
			},
			{
				fieldName: "date",
				successCount: 6,
				totalAttempts: 10,
				isOptional: false,
				missingItems: [2, 5, 8, 9],
			},
		];

		const result = createMockResultWithErrors([], [], fieldStats);

		await showCrawlErrors(result);

		const writeFileCall = vi.mocked(writeFileSync).mock.calls[0];
		const content = writeFileCall[1] as string;

		expect(content).toContain("LISTING EXTRACTION ERRORS");
		expect(content).toContain("Required Field Extraction Issues:");
		expect(content).toContain("2 item(s) missing required field: title");
		expect(content).toContain("4 item(s) missing required field: date");
		expect(content).toContain("Total field extraction issues: 2");
		expect(content).toContain("Total errors: 2");
	});
});
