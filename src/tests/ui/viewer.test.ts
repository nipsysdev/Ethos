import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessingSummaryResult } from "@/core/ProcessingPipeline";
import {
	createMetadataStore,
	type MetadataStore,
} from "@/storage/MetadataStore.js";
import { showExtractedData } from "@/ui/viewer.js";

// Mock child_process and inquirer
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn(),
	},
}));

// Mock MetadataStore
const mockGetSession = vi.fn();
const mockGetSessionContents = vi.fn();

vi.mock("@/storage/MetadataStore.js", () => ({
	createMetadataStore: vi.fn().mockImplementation(() => ({
		getSession: mockGetSession,
		getSessionContents: mockGetSessionContents,
	})),
}));

const mockSpawn = vi.mocked((await import("node:child_process")).spawn);
const mockInquirer = vi.mocked((await import("inquirer")).default);
const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Data Viewer", () => {
	let tempStoragePath: string;
	let metadataStoreFactory: () => MetadataStore;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock implementations
		mockGetSession.mockReset();
		mockGetSessionContents.mockReset();
		tempStoragePath = resolve(
			process.cwd(),
			`test-storage-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);
		metadataStoreFactory = () => createMetadataStore(tempStoragePath);
	});

	afterEach(() => {
		try {
			rmSync(tempStoragePath, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	const createMockResult = (withSession = true): ProcessingSummaryResult => {
		const sessionId = withSession ? "test-session-123" : undefined;

		if (withSession) {
			// Mock junction table data instead of itemsForViewer
			const mockSessionContents = [
				{
					id: 1,
					hash: "abc123",
					source: "test-source",
					url: "https://example.com/article1",
					title: "Test Article",
					publishedDate: new Date("2024-12-31"),
					crawledAt: new Date(),
					createdAt: new Date(),
					processedOrder: 1,
					hadContentExtractionError: false,
				},
			];

			const mockSessionData = {
				id: sessionId,
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date(),
				isActive: true,
				metadata: JSON.stringify({}), // Empty metadata since we use junction table now
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockGetSession.mockReturnValue(mockSessionData);
			mockGetSessionContents.mockReturnValue(mockSessionContents);
		}
		// If withSession is false, we don't set up the mock, so sessionId will be undefined
		// and the viewer will check for that first before calling getSession

		return {
			summary: {
				sourceId: "test-source",
				sourceName: "Test Source",
				itemsFound: 1,
				itemsProcessed: 1,
				itemsWithErrors: 0,
				fieldStats: [],
				contentFieldStats: [],
				listingErrors: [],
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:00:05Z"),
				sessionId,
			},
		};
	};

	it("should display message when no crawl session available", async () => {
		const result = createMockResult(false); // Don't create session

		await showExtractedData(result, metadataStoreFactory());

		expect(mockLog).toHaveBeenCalledWith(
			"No crawl session available for viewing.",
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

		await showExtractedData(result, metadataStoreFactory());

		// Verify inquirer was called with the correct structure
		expect(mockInquirer.prompt).toHaveBeenCalledWith([
			expect.objectContaining({
				type: "list",
				name: "selectedFile",
				message: "Select an item to view - 1 total items:",
				choices: [
					{
						name: expect.stringMatching(/1\. Test Article \(.+\)/),
						value: expect.stringContaining("abc123.json"),
						short: "Test Article",
					},
					{
						name: "Back to menu",
						value: "back",
						short: "Back",
					},
				],
				pageSize: 2,
			}),
		]);

		// Verify less was called with the actual file path
		expect(actualSelectedFile).toContain("abc123.json");
		expect(mockSpawn).toHaveBeenCalledWith("less", ["-R", actualSelectedFile], {
			stdio: "inherit",
		});
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

		await showExtractedData(result, metadataStoreFactory());

		expect(mockLog).toHaveBeenCalledWith(
			"Less viewer not available. Please install 'less' to view files.",
		);
		expect(mockLog).toHaveBeenCalledWith(
			`File location: ${actualSelectedFile}`,
		);
	});

	it("should handle back option", async () => {
		const result = createMockResult();

		mockInquirer.prompt.mockResolvedValueOnce({
			selectedFile: "back",
		});

		await showExtractedData(result, metadataStoreFactory());

		expect(mockInquirer.prompt).toHaveBeenCalledTimes(1);
		expect(mockSpawn).not.toHaveBeenCalled();
	});
});
