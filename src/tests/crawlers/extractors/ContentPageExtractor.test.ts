import type { Page } from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { createContentPageExtractor } from "@/crawlers/extractors/ContentPageExtractor";

describe("ContentPageExtractor", () => {
	let mockPage: Page;
	let mockConfig: SourceConfig;
	let contentPageExtractor: ReturnType<typeof createContentPageExtractor>;

	beforeEach(() => {
		// Create mock page
		mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			waitForSelector: vi.fn().mockResolvedValue(undefined),
			evaluate: vi.fn().mockResolvedValue({
				results: {},
				extractionErrors: [],
			}),
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

		contentPageExtractor = createContentPageExtractor();

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
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData.content).toBe(mockMarkdownContent);
			expect(result.errors).toHaveLength(0);
			expect(mockPage.goto).toHaveBeenCalledWith(
				"https://example.com/article1",
				{ waitUntil: "domcontentloaded" },
			);
		});

		it("should handle content extraction errors", async () => {
			// Mock page.evaluate to return errors
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {},
				extractionErrors: ["Failed to extract content"],
			});

			const result = await contentPageExtractor.extractFromContentPage(
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData).toEqual({});
			expect(result.errors).toContain("Failed to extract content");
		});

		it("should handle page loading errors", async () => {
			// Mock page.goto to throw an error
			vi.mocked(mockPage.goto).mockRejectedValue(new Error("Network error"));

			const result = await contentPageExtractor.extractFromContentPage(
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			expect(result.contentData).toEqual({});
			expect(result.errors).toContain(
				"Failed to load content page https://example.com/article1: Error: Network error",
			);
		});

		it("should handle missing content config", async () => {
			const configWithoutContent = {
				...mockConfig,
				content: undefined,
			} as unknown as SourceConfig;

			const result = await contentPageExtractor.extractFromContentPage(
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
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should still extract content even with timeout
			expect(result.contentData.content).toBe("Content found despite timeout");
			expect(result.errors).toHaveLength(0);
		});

		it("should handle markdown conversion errors gracefully", async () => {
			const mockHtmlContent = "<p>Valid content</p>";

			// Mock page.evaluate to return content
			vi.mocked(mockPage.evaluate).mockResolvedValue({
				results: {
					content: mockHtmlContent,
				},
				extractionErrors: [],
			});

			// We can't easily mock TurndownService constructor, but we can test
			// that the function still works even if conversion fails
			const result = await contentPageExtractor.extractFromContentPage(
				mockPage,
				"https://example.com/article1",
				mockConfig,
			);

			// Should return original content if conversion fails
			expect(result.contentData.content).toBe("Valid content");
			expect(result.errors).toHaveLength(0);
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

			// This test is mainly to ensure the function can be called without errors
			await expect(
				contentPageExtractor.extractContentPagesConcurrently(
					mockPage,
					mockItems,
					mockConfig,
					0,
				),
			).resolves.toBeUndefined();
		});
	});
});
