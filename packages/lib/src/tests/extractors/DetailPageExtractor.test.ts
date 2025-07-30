import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "../../core/types.js";
import { CRAWLER_TYPES } from "../../core/types.js";
import { DetailPageExtractor } from "../../crawlers/extractors/DetailPageExtractor.js";

describe("DetailPageExtractor", () => {
	const mockConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: CRAWLER_TYPES.LISTING,
		listing: {
			url: "https://example.com",
			items: {
				container_selector: ".article",
				fields: {
					title: { selector: ".title", attribute: "text" },
					url: { selector: "a", attribute: "href" },
				},
			},
		},
		detail: {
			container_selector: ".article-content",
			fields: {
				title: { selector: "h1", attribute: "text" },
				content: { selector: ".content", attribute: "text" },
				author: { selector: ".author", attribute: "text" },
			},
		},
	};

	it("should extract detail data successfully", async () => {
		const extractor = new DetailPageExtractor();
		const mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			evaluate: vi.fn().mockResolvedValue({
				results: {
					title: "Detailed Article Title",
					content: "Full article content here",
					author: "Jane Smith",
				},
				extractionErrors: [],
			}),
		} as unknown as Page;

		const result = await extractor.extractFromDetailPage(
			mockPage,
			"/article/123",
			mockConfig,
		);

		expect(result.detailData.title).toBe("Detailed Article Title");
		expect(result.detailData.content).toBe("Full article content here");
		expect(result.detailData.author).toBe("Jane Smith");
		expect(result.errors).toHaveLength(0);
		expect(mockPage.goto).toHaveBeenCalledWith(
			"https://example.com/article/123",
			{ waitUntil: "domcontentloaded" },
		);
	});

	it("should handle extraction errors gracefully", async () => {
		const extractor = new DetailPageExtractor();
		const mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			evaluate: vi.fn().mockResolvedValue({
				results: {
					title: "Test Title",
					content: null,
					author: null,
				},
				extractionErrors: [
					"Failed to extract content: element not found",
					"Failed to extract author: element not found",
				],
			}),
		} as unknown as Page;

		const result = await extractor.extractFromDetailPage(
			mockPage,
			"/article/456",
			mockConfig,
		);

		expect(result.detailData.title).toBe("Test Title");
		expect(result.detailData.content).toBeNull();
		expect(result.detailData.author).toBeNull();
		expect(result.errors).toHaveLength(2);
		expect(result.errors[0]).toContain("Failed to extract content");
	});

	it("should handle page navigation failures", async () => {
		const extractor = new DetailPageExtractor();
		const mockPage = {
			goto: vi.fn().mockRejectedValue(new Error("Navigation timeout")),
		} as unknown as Page;

		const result = await extractor.extractFromDetailPage(
			mockPage,
			"/article/broken",
			mockConfig,
		);

		expect(result.detailData).toEqual({});
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("Failed to load detail page");
		expect(result.errors[0]).toContain("Navigation timeout");
	});

	it("should return early when no detail config exists", async () => {
		const extractor = new DetailPageExtractor();
		const configNoDetail = { ...mockConfig };
		delete configNoDetail.detail;

		const mockPage = {
			goto: vi.fn(),
			evaluate: vi.fn(),
		} as unknown as Page;

		const result = await extractor.extractFromDetailPage(
			mockPage,
			"/article/123",
			configNoDetail,
		);

		expect(result.detailData).toEqual({});
		expect(result.errors).toHaveLength(0);
		expect(mockPage.goto).not.toHaveBeenCalled();
		expect(mockPage.evaluate).not.toHaveBeenCalled();
	});

	it("should handle absolute URLs correctly", async () => {
		const extractor = new DetailPageExtractor();
		const mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			evaluate: vi.fn().mockResolvedValue({
				results: { title: "Test" },
				extractionErrors: [],
			}),
		} as unknown as Page;

		await extractor.extractFromDetailPage(
			mockPage,
			"https://other-domain.com/article/123",
			mockConfig,
		);

		// Should use the absolute URL as-is, not resolve it
		expect(mockPage.goto).toHaveBeenCalledWith(
			"https://other-domain.com/article/123",
			{ waitUntil: "domcontentloaded" },
		);
	});
});
