import type { Browser, Page } from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "../../../core/types.js";
import { CRAWLER_TYPES } from "../../../core/types.js";
import { DetailPageExtractor } from "../../../crawlers/extractors/DetailPageExtractor.js";

describe("DetailPageExtractor - Concurrent Processing", () => {
	let extractor: DetailPageExtractor;
	let mockPage: Page;
	let mockBrowser: Partial<Browser>;
	let mockNewPage: Partial<Page>;

	beforeEach(() => {
		extractor = new DetailPageExtractor();

		// Mock new pages that browser.newPage() creates
		mockNewPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			evaluate: vi
				.fn()
				.mockResolvedValue({ results: {}, extractionErrors: [] }),
			close: vi.fn().mockResolvedValue(undefined),
		};

		// Mock browser that can create new pages
		mockBrowser = {
			newPage: vi.fn().mockResolvedValue(mockNewPage),
		};

		// Mock main page
		mockPage = {
			browser: vi.fn().mockReturnValue(mockBrowser),
			goto: vi.fn().mockResolvedValue(undefined),
			evaluate: vi
				.fn()
				.mockResolvedValue({ results: {}, extractionErrors: [] }),
		} as unknown as Page;
	});

	const createTestConfig = (): SourceConfig => ({
		id: "test",
		name: "Test Source",
		type: CRAWLER_TYPES.LISTING,
		listing: {
			url: "https://example.com",
			items: {
				container_selector: "article",
				fields: {
					title: { selector: "h1", attribute: "text" },
				},
			},
		},
		detail: {
			container_selector: "main",
			fields: {
				content: { selector: ".content", attribute: "text" },
				author: { selector: ".author", attribute: "text" },
			},
		},
	});

	const createTestItems = (count: number): CrawledData[] => {
		return Array.from({ length: count }, (_, i) => ({
			url: `https://example.com/article-${i + 1}`,
			timestamp: new Date(),
			source: "test",
			title: `Article ${i + 1}`,
			content: `Content ${i + 1}`,
			metadata: {},
		}));
	};

	it("should create additional pages for concurrent processing", async () => {
		const config = createTestConfig();
		const items = createTestItems(5);
		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];
		const concurrency = 3;

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			concurrency,
		);

		// Should create concurrency-1 additional pages (main page + 2 extra = 3 total)
		expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
		expect(mockNewPage.close).toHaveBeenCalledTimes(2);
	});

	it("should not create more pages than items", async () => {
		const config = createTestConfig();
		const items = createTestItems(2);
		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];
		const concurrency = 5;

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			concurrency,
		);

		// Should only create 1 additional page (2 items - 1 = 1 extra page)
		expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
		expect(mockNewPage.close).toHaveBeenCalledTimes(1);
	});

	it("should process all items with concurrent pages", async () => {
		const config = createTestConfig();
		const items = createTestItems(4);
		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [
			{
				fieldName: "content",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
			{
				fieldName: "author",
				successCount: 0,
				totalAttempts: 0,
				isOptional: false,
				missingItems: [],
			},
		];

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			2, // Process 2 at a time
		);

		// Should have attempted extraction for all items
		expect(detailFieldStats[0].totalAttempts).toBe(4);
		expect(detailFieldStats[1].totalAttempts).toBe(4);
	});

	it("should clean up extra pages even if extraction fails", async () => {
		const config = createTestConfig();
		const items = createTestItems(3);
		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];

		// Make one of the pages fail
		const failingMockPage = {
			goto: vi.fn().mockRejectedValue(new Error("Network error")),
			evaluate: vi
				.fn()
				.mockResolvedValue({ results: {}, extractionErrors: [] }),
			close: vi.fn().mockResolvedValue(undefined),
		};

		// Override the browser mock to return failing page for first call
		const mockBrowserWithFailure = {
			newPage: vi
				.fn()
				.mockResolvedValueOnce(failingMockPage)
				.mockResolvedValue(mockNewPage),
		};

		const mockPageWithFailure = {
			...mockPage,
			browser: vi.fn().mockReturnValue(mockBrowserWithFailure),
		} as unknown as Page;

		await extractor.extractDetailData(
			mockPageWithFailure,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			3,
		);

		// Should still clean up the extra pages
		expect(failingMockPage.close).toHaveBeenCalledTimes(1);
		expect(vi.mocked(mockNewPage.close)).toHaveBeenCalledTimes(1);
	});
});
