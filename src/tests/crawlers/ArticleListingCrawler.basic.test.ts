import { describe, expect, it, vi } from "vitest";
import { CRAWLER_TYPES, type SourceConfig } from "@/core/types.js";
import { createArticleListingCrawler } from "@/crawlers/ArticleListingCrawler.js";

// Mock the BrowserHandler to prevent Puppeteer from being called
vi.mock("@/crawlers/handlers/BrowserHandler.js", () => {
	return {
		createBrowserHandler: vi.fn().mockResolvedValue({
			setupNewPage: vi.fn().mockResolvedValue({}),
			close: vi.fn().mockResolvedValue(undefined),
			resetBrowser: vi.fn().mockResolvedValue(undefined),
			goto: vi.fn().mockResolvedValue(undefined),
		}),
	};
});

describe("ArticleListingCrawler - Basic Functionality", () => {
	it("should have correct type", () => {
		const crawler = createArticleListingCrawler();
		expect(crawler.type).toBe(CRAWLER_TYPES.LISTING);
	});

	it("should reject non-listing config types", async () => {
		const crawler = createArticleListingCrawler();
		const nonListingConfig = {
			id: "test",
			name: "Test",
			type: "single" as const,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".item",
					fields: {
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
			content: {
				url_selector: ".content-url",
				fields: {
					content: { selector: ".content", attribute: "text" },
				},
			},
		} as unknown as SourceConfig; // Type assertion to allow testing invalid config

		await expect(crawler.crawl(nonListingConfig)).rejects.toThrow(
			"Config type must be 'listing' (only supported type in Phase 1)",
		);
	});
});
