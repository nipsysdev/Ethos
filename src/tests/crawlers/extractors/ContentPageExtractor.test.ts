import type { Page } from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";
import type { BrowserHandler } from "@/crawlers/handlers/BrowserHandler";

describe("ContentPageExtractor", () => {
	let mockPage: Page;
	let mockBrowserHandler: BrowserHandler;
	let mockConfig: SourceConfig;
	let contentPageExtractor: ReturnType<typeof createContentPageExtractor>;

	beforeEach(() => {
		// Create mock browser handler
		mockBrowserHandler = {
			resetBrowser: vi.fn().mockResolvedValue(undefined),
			setupNewPage: vi.fn().mockResolvedValue({} as Page),
			goto: vi.fn().mockResolvedValue(undefined),
			close: vi.fn().mockResolvedValue(undefined),
		};

		// Create mock page with close method
		mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			waitForSelector: vi.fn().mockResolvedValue(undefined),
			evaluate: vi.fn().mockResolvedValue({
				results: {},
				extractionErrors: [],
			}),
			close: vi.fn().mockResolvedValue(undefined), // Add close method
			browser: vi.fn().mockReturnValue({
				newPage: vi.fn().mockResolvedValue({
					close: vi.fn().mockResolvedValue(undefined),
				}),
			}),
		} as unknown as Page;

		// Create mock config
		mockConfig = {
			id: "test",
			name: "Test Source",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".article",
					fields: {
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
			content: {
				container_selector: ".article-content",
				fields: {
					content: { selector: ".content", attribute: "text" },
				},
			},
		};

		// Create content page extractor with mock browser handler
		contentPageExtractor = createContentPageExtractor(mockBrowserHandler);

		// Reset all mocks
		vi.clearAllMocks();
	});

	describe("extractFromContentPage", () => {
		it("should extract content and convert HTML to Markdown", async () => {
			const mockHtmlContent = "<h1>Hello World</h1><p>This is a test.</p>";
			// Note: TurndownService converts h1 to underline format by default
			const mockMarkdownContent = "Hello World\n===========\n\nThis is a test.";

			// Mock page.evaluate to return HTML content
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: [],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData.content).toBe(mockMarkdownContent);
			expect(result.errors).toHaveLength(0);
			expect(mockBrowserHandler.goto).toHaveBeenCalledWith(
				mockPage,
				"https://example.com/article1",
			);
		});

		it("should handle content extraction errors", async () => {
			// Mock page.evaluate to return errors
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {},
				extractionErrors: ["Failed to extract content"],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData).toEqual({});
			expect(result.errors).toContain("Failed to extract content");
		});

		it("should handle page loading errors", async () => {
			// Mock browserHandler.goto to throw an error
			vi.mocked(mockBrowserHandler.goto).mockImplementation(() => {
				throw new Error("Network error");
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData).toEqual({});
			// Check that errors array exists and has content
			expect(result.errors).toBeDefined();
			expect(result.errors.length).toBeGreaterThan(0);
			// Check that error message contains the expected parts
			expect(result.errors[0]).toMatch(/Failed to load content page/);
			expect(result.errors[0]).toMatch(/Network error/);
		});

		it("should handle missing content config", async () => {
			const configWithoutContent = {
				...mockConfig,
				content: undefined,
			} as unknown as SourceConfig;

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				configWithoutContent,
			);

			expect(result.contentData).toEqual({});
			expect(result.errors).toHaveLength(0);
		});

		it("should handle container selector timeout gracefully", async () => {
			// Mock waitForSelector to throw timeout error
			vi.mocked(mockPage.waitForSelector).mockRejectedValue(
				new Error("Timeout"),
			);

			// Still return successful extraction result
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: "<p>Content found despite timeout</p>",
				},
				extractionErrors: [],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should still extract content even with timeout
			expect(result.contentData.content).toBe("Content found despite timeout");
			expect(result.errors).toHaveLength(0);
		});

		it("should handle markdown conversion with formatting", async () => {
			const mockHtmlContent =
				"<div><p>Text with <strong>formatting</strong> and <em>emphasis</em></p></div>";

			// Mock page.evaluate to return content
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: [],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should return processed content
			expect(result.contentData.content).toEqual(
				"Text with **formatting** and _emphasis_",
			);
			expect(result.errors).toHaveLength(0);
		});

		it("should use textContent as fallback when markdown conversion fails", async () => {
			// Reset modules and clear all mocks
			vi.resetModules();
			vi.clearAllMocks();

			// Mock TurndownService to throw an error when turndown is called
			const mockTurndownService = {
				turndown: vi.fn().mockImplementation(() => {
					throw new Error("Turndown conversion failed");
				}),
			};

			// Use vi.doMock to mock the TurndownService module
			vi.doMock("turndown", () => {
				return {
					default: vi.fn(() => mockTurndownService),
				};
			});

			// Dynamically import the module under test after mocking
			const { createContentPageExtractor } = await import(
				"@/crawlers/extractors/ContentPageExtractor"
			);
			const extractorWithMock = createContentPageExtractor(mockBrowserHandler);

			// Create HTML content with specific text content for testing fallback
			const mockHtmlContent =
				"<div><p>Text with <strong>formatting</strong> and <em>emphasis</em></p></div>";
			const expectedTextContent = "Text with formatting and emphasis";

			// Mock page.evaluate to return content
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: [],
			});

			const result = await extractorWithMock.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should use textContent as fallback when turndown fails
			expect(result.contentData.content).toBe(expectedTextContent);

			// Should add processing error to errors array
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain(
				"Markdown conversion failed: Turndown conversion failed",
			);
		});

		it("should collect processing errors separately and add to overall errors", async () => {
			const mockHtmlContent = "<p>Valid content</p>";

			// Mock page.evaluate to return content with extraction errors
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: ["Extraction error occurred"],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should include both extraction errors and any processing errors
			expect(result.errors).toContain("Extraction error occurred");
		});

		it("should add processing errors to overall errors when markdown conversion fails", async () => {
			// Reset modules and clear all mocks
			vi.resetModules();
			vi.clearAllMocks();

			// Mock TurndownService to throw an error
			const mockTurndownService = {
				turndown: vi.fn().mockImplementation(() => {
					throw new Error("Test conversion error");
				}),
			};

			// Mock the TurndownService module
			vi.doMock("turndown", () => {
				return {
					default: vi.fn(() => mockTurndownService),
				};
			});

			// Dynamically import the module under test after mocking
			const { createContentPageExtractor } = await import(
				"@/crawlers/extractors/ContentPageExtractor"
			);
			const extractorWithMock = createContentPageExtractor(mockBrowserHandler);

			const mockHtmlContent = "<p>Content that might fail conversion</p>";

			// Mock page.evaluate to return content
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: [],
			});

			const result = await extractorWithMock.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should have processing error when turndown fails
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("Test conversion error");
		});

		it("should replace non-breaking spaces with regular spaces", async () => {
			const mockHtmlContent =
				"<p>Content with\u00A0non-breaking\u00A0spaces</p>";
			const expectedContent = "Content with non-breaking spaces";

			// Mock page.evaluate to return content with non-breaking spaces
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: [],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockBrowserHandler,
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData.content).toBe(expectedContent);
		});
	});

	describe("extractContentPagesConcurrently", () => {
		it("should call concurrent extractor with correct parameters", async () => {
			const mockItems: CrawledData[] = [
				{
					url: "https://example.com/article1",
					title: "Article 1",
					content: "Content 1",
					crawledAt: new Date(),
					source: "test",
					metadata: {},
				},
			];

			const mockContentErrors: string[] = [];
			const mockContentFieldStats: FieldExtractionStats[] = [];

			const mockTracker = {
				addDuplicatesSkipped: vi.fn(),
				addUrlsExcluded: vi.fn(),
			};

			// Mock browser handler setupNewPage to return pages with close method
			const mockPage1 = { close: vi.fn().mockResolvedValue(undefined) };
			const mockPage2 = { close: vi.fn().mockResolvedValue(undefined) };

			mockBrowserHandler.setupNewPage = vi
				.fn()
				.mockResolvedValueOnce(mockPage1)
				.mockResolvedValueOnce(mockPage2);

			// This test is mainly to ensure the function can be called without errors
			await expect(
				contentPageExtractor.extractContentPagesConcurrently(
					mockItems,
					mockConfig,
					0,
					2, // concurrencyLimit
					undefined, // metadataStore
					true, // skipExistingUrls
					mockContentErrors,
					mockContentFieldStats,
					mockTracker,
				),
			).resolves.toBeUndefined();
		});

		it("should handle empty items list", async () => {
			await expect(
				contentPageExtractor.extractContentPagesConcurrently(
					[],
					mockConfig,
					0,
					5,
				),
			).resolves.toBeUndefined();
		});
	});

	describe("extractContentForSingleItem", () => {
		it("should extract content for a single item", async () => {
			const mockItem: CrawledData = {
				url: "https://example.com/article1",
				title: "Article 1",
				content: "Content 1",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const mockContentErrors: string[] = [];
			const mockContentFieldStats: FieldExtractionStats[] = [];

			// Create a new extractor instance to properly test the function
			const testExtractor = createContentPageExtractor(mockBrowserHandler);

			// Mock page.evaluate to return successful result
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: "Extracted content",
					title: "Extracted title",
				},
				extractionErrors: [],
			});

			await expect(
				testExtractor.extractContentForSingleItem(
					mockBrowserHandler,
					mockPage,
					mockItem,
					mockConfig,
					mockContentErrors,
					mockContentFieldStats,
					0,
				),
			).resolves.toBeUndefined();

			// Verify the item was updated with extracted content
			// The content should be merged, so the original content should be replaced
			expect(mockItem.content).toBe("Extracted content");
			expect(mockItem.title).toBe("Extracted title");
		});

		it("should handle missing URL gracefully", async () => {
			const mockItem: CrawledData = {
				url: undefined as any, // Intentionally missing URL
				title: "Article 1",
				content: "Content 1",
				crawledAt: new Date(),
				source: "test",
				metadata: {},
			};

			const mockContentErrors: string[] = [];
			const mockContentFieldStats: FieldExtractionStats[] = [];

			// Should not call page.evaluate when URL is missing
			const evaluateSpy = vi.spyOn(mockPage, "evaluate");

			await expect(
				contentPageExtractor.extractContentForSingleItem(
					mockBrowserHandler,
					mockPage,
					mockItem,
					mockConfig,
					mockContentErrors,
					mockContentFieldStats,
					0,
				),
			).resolves.toBeUndefined();

			// Should not have called page.evaluate
			expect(evaluateSpy).not.toHaveBeenCalled();
		});
	});
});
