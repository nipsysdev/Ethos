import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleSessions } from "@/commands/sessions";
import type { ProcessingPipeline } from "@/core/ProcessingPipeline";
import type { CrawlSession, MetadataStore } from "@/storage/MetadataStore";

// Mock inquirer
const mockPrompt = vi.fn();
vi.mock("inquirer", () => ({
	default: {
		prompt: mockPrompt,
	},
}));

// Mock display and viewer modules
vi.mock("../../ui/summary.js", () => ({
	displayCrawlSummary: vi.fn(),
}));

vi.mock("../../ui/viewer.js", () => ({
	showExtractedData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../commands/errors.js", () => ({
	showCrawlErrors: vi.fn().mockResolvedValue(undefined),
}));

const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("Sessions Command", () => {
	let mockPipeline: ProcessingPipeline;
	let mockMetadataStore: MetadataStore;
	let mockDisplayCrawlSummary: ReturnType<typeof vi.fn>;
	let mockShowExtractedData: ReturnType<typeof vi.fn>;
	let mockShowCrawlErrors: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Get the mocked functions
		const { displayCrawlSummary } = await import("../../ui/summary.js");
		const { showExtractedData } = await import("../../ui/viewer.js");
		const { showCrawlErrors } = await import("../../commands/errors.js");

		mockDisplayCrawlSummary = vi.mocked(displayCrawlSummary);
		mockShowExtractedData = vi.mocked(showExtractedData);
		mockShowCrawlErrors = vi.mocked(showCrawlErrors);

		// Create mock metadata store
		mockMetadataStore = {
			getAllSessions: vi.fn(),
			getSession: vi.fn(),
			getSessionContents: vi.fn(),
			close: vi.fn(),
		} as unknown as MetadataStore;

		// Create mock pipeline
		mockPipeline = {
			getMetadataStore: vi.fn().mockReturnValue(mockMetadataStore),
		} as unknown as ProcessingPipeline;
	});

	it("should show message when no sessions are found", async () => {
		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue([]);

		const result = await handleSessions(mockPipeline);

		expect(mockLog).toHaveBeenCalledWith(
			"No crawl sessions found. Start a crawl to create your first session!",
		);
		expect(result).toBe("main");
	});

	it("should display sessions list and allow selection", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "{}",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "main" });

		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue([
			{
				id: 1,
				hash: "test-hash",
				source: "test-source",
				url: "https://example.com",
				title: "Test Article",
				author: "Test Author",
				publishedDate: new Date("2025-01-01"),
				crawledAt: new Date("2025-01-01T10:00:00Z"),
				createdAt: new Date("2025-01-01T10:00:00Z"),
				processedOrder: 1,
				hadContentExtractionError: false,
			},
		]);

		const result = await handleSessions(mockPipeline);

		expect(mockPrompt).toHaveBeenCalledWith([
			{
				type: "list",
				name: "selectedSessionId",
				message: "Select a crawl session to view (1 available):",
				choices: expect.arrayContaining([
					expect.objectContaining({
						name: expect.stringContaining("Test Source"),
						value: "session-1",
					}),
					{ name: "Back to main menu", value: "back" },
				]),
			},
		]);

		expect(mockDisplayCrawlSummary).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("should return to main when back is selected", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "{}",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		mockPrompt.mockResolvedValueOnce({ selectedSessionId: "back" });

		const result = await handleSessions(mockPipeline);

		expect(result).toBe("main");
		expect(mockDisplayCrawlSummary).not.toHaveBeenCalled();
	});

	it("should handle view action and return to session menu", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "{}",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue([
			{
				id: 1,
				hash: "test-hash",
				source: "test-source",
				url: "https://example.com",
				title: "Test Article",
				author: "Test Author",
				publishedDate: new Date("2025-01-01"),
				crawledAt: new Date("2025-01-01T10:00:00Z"),
				createdAt: new Date("2025-01-01T10:00:00Z"),
				processedOrder: 1,
				hadContentExtractionError: false,
			},
		]);

		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "view" })
			.mockResolvedValueOnce({ action: "main" });

		const result = await handleSessions(mockPipeline);

		expect(mockShowExtractedData).toHaveBeenCalled();
		expect(mockDisplayCrawlSummary).toHaveBeenCalledTimes(2); // Once after selection, once after viewing
		expect(result).toBe("main");
	});

	it("should handle errors action", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "{}",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue([]);

		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "errors" })
			.mockResolvedValueOnce({ action: "main" });

		const result = await handleSessions(mockPipeline);

		expect(mockShowCrawlErrors).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("should return to sessions list when sessions action is selected", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "{}",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue([]);

		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "sessions" })
			.mockResolvedValueOnce({ selectedSessionId: "back" });

		const result = await handleSessions(mockPipeline);

		expect(mockPrompt).toHaveBeenCalledTimes(3);
		expect(result).toBe("main");
	});

	it("should handle session creation with parsed metadata", async () => {
		const sessionMetadata = {
			pagesProcessed: 5,
			duplicatesSkipped: 2,
			listingErrors: ["Error 1", "Error 2"],
		};

		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: JSON.stringify(sessionMetadata),
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue([
			{
				id: 1,
				hash: "test-hash",
				source: "test-source",
				url: "https://example.com",
				title: "Test Article",
				author: "Test Author",
				publishedDate: new Date("2025-01-01"),
				crawledAt: new Date("2025-01-01T10:00:00Z"),
				createdAt: new Date("2025-01-01T10:00:00Z"),
				processedOrder: 1,
				hadContentExtractionError: false,
			},
		]);

		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "main" });

		await handleSessions(mockPipeline);

		expect(mockDisplayCrawlSummary).toHaveBeenCalledWith(
			expect.objectContaining({
				summary: expect.objectContaining({
					pagesProcessed: 5,
					duplicatesSkipped: 2,
					listingErrors: ["Error 1", "Error 2"],
				}),
			}),
		);
	});

	it("should handle malformed session metadata gracefully", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "invalid-json{",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue([]);

		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "main" });

		await handleSessions(mockPipeline);

		expect(consoleWarn).toHaveBeenCalledWith(
			"Could not parse session metadata:",
			expect.any(Error),
		);
		expect(mockDisplayCrawlSummary).toHaveBeenCalled();

		consoleWarn.mockRestore();
	});

	it("should calculate field stats correctly from session contents", async () => {
		const mockSessions: CrawlSession[] = [
			{
				id: "session-1",
				sourceId: "test-source",
				sourceName: "Test Source",
				startTime: new Date("2025-01-01T10:00:00Z"),
				endTime: new Date("2025-01-01T10:01:00Z"),
				metadata: "{}",
				createdAt: new Date("2025-01-01T10:00:00Z"),
				updatedAt: new Date("2025-01-01T10:01:00Z"),
			},
		];

		const sessionContents = [
			{
				id: 1,
				hash: "hash1",
				source: "test-source",
				url: "https://example.com/1",
				title: "Article 1",
				author: "Author 1",
				publishedDate: new Date("2025-01-01"),
				crawledAt: new Date("2025-01-01T10:00:00Z"),
				createdAt: new Date("2025-01-01T10:00:00Z"),
				processedOrder: 1,
				hadContentExtractionError: false,
			},
			{
				id: 2,
				hash: "hash2",
				source: "test-source",
				url: "https://example.com/2",
				title: "Article 2",
				author: undefined,
				publishedDate: undefined,
				crawledAt: new Date("2025-01-01T10:00:00Z"),
				createdAt: new Date("2025-01-01T10:00:00Z"),
				processedOrder: 2,
				hadContentExtractionError: true,
			},
		];

		vi.mocked(mockMetadataStore.getAllSessions).mockReturnValue(mockSessions);
		vi.mocked(mockMetadataStore.getSession).mockReturnValue(mockSessions[0]);
		vi.mocked(mockMetadataStore.getSessionContents).mockReturnValue(
			sessionContents,
		);

		mockPrompt
			.mockResolvedValueOnce({ selectedSessionId: "session-1" })
			.mockResolvedValueOnce({ action: "main" });

		await handleSessions(mockPipeline);

		expect(mockDisplayCrawlSummary).toHaveBeenCalledWith(
			expect.objectContaining({
				summary: expect.objectContaining({
					itemsFound: 2,
					itemsProcessed: 2,
					itemsWithErrors: 1,
					fieldStats: expect.arrayContaining([
						expect.objectContaining({
							fieldName: "title",
							successCount: 2,
							totalAttempts: 2,
						}),
						expect.objectContaining({
							fieldName: "author",
							successCount: 1,
							totalAttempts: 2,
						}),
					]),
					contentFieldStats: expect.arrayContaining([
						expect.objectContaining({
							fieldName: "content",
							successCount: 1,
							totalAttempts: 2,
						}),
					]),
				}),
			}),
		);
	});
});
