import type { Page } from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { DetailPageExtractor } from "@/crawlers/extractors/DetailPageExtractor.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

describe("DetailPageExtractor - URL Skipping", () => {
	let extractor: DetailPageExtractor;
	let mockPage: Page;
	let mockMetadataStore: Partial<MetadataStore>;
	let mockExistsByUrl: ReturnType<typeof vi.fn>;
	let mockGetExistingUrls: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		extractor = new DetailPageExtractor();

		// Mock page
		mockPage = {
			browser: vi.fn().mockReturnValue({
				newPage: vi.fn().mockResolvedValue({
					goto: vi.fn().mockResolvedValue(undefined),
					evaluate: vi
						.fn()
						.mockResolvedValue({ results: {}, extractionErrors: [] }),
					close: vi.fn().mockResolvedValue(undefined),
				}),
			}),
		} as unknown as Page;

		// Mock metadata store
		mockExistsByUrl = vi.fn().mockReturnValue(false);
		mockGetExistingUrls = vi.fn().mockReturnValue(new Set<string>());
		mockMetadataStore = {
			existsByUrl: mockExistsByUrl,
			getExistingUrls: mockGetExistingUrls,
		};
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
			},
		},
	});

	const createTestItems = (urls: string[]): CrawledData[] => {
		return urls.map((url, i) => ({
			url,
			timestamp: new Date(),
			source: "test",
			title: `Article ${i + 1}`,
			content: `Content ${i + 1}`,
			metadata: {},
		}));
	};

	it("should skip URLs that already exist in the database", async () => {
		const config = createTestConfig();
		const items = createTestItems([
			"https://example.com/article-1", // Will be marked as existing
			"https://example.com/article-2", // Will be marked as new
			"https://example.com/article-3", // Will be marked as existing
		]);

		// Mock metadata store to return existing URLs for articles 1 and 3
		mockGetExistingUrls.mockReturnValue(
			new Set([
				"https://example.com/article-1",
				"https://example.com/article-3",
			]),
		);

		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			5,
			mockMetadataStore as MetadataStore,
			true, // skipExistingUrls enabled
		);

		// Should have called the batch method once with all URLs
		expect(mockGetExistingUrls).toHaveBeenCalledTimes(1);
		expect(mockGetExistingUrls).toHaveBeenCalledWith([
			"https://example.com/article-1",
			"https://example.com/article-2",
			"https://example.com/article-3",
		]);

		// Should not have called individual existsByUrl anymore
		expect(mockExistsByUrl).not.toHaveBeenCalled();

		// Should log summary message only
		expect(consoleSpy).toHaveBeenCalledWith(
			"📊 Skipped 2 URLs already in database, processing 1 new URLs",
		);

		// Should NOT log individual URL skipping messages
		expect(consoleSpy).not.toHaveBeenCalledWith(
			"⏭️  Skipping detail extraction for existing URL: https://example.com/article-1",
		);
		expect(consoleSpy).not.toHaveBeenCalledWith(
			"⏭️  Skipping detail extraction for existing URL: https://example.com/article-3",
		);

		// Should only create 1 page (for the 1 remaining item)
		expect(mockPage.browser().newPage).toHaveBeenCalledTimes(1);

		consoleSpy.mockRestore();
	});

	it("should process all URLs when skipExistingUrls is disabled", async () => {
		const config = createTestConfig();
		const items = createTestItems([
			"https://example.com/article-1",
			"https://example.com/article-2",
		]);

		// Mock metadata store to return existing URLs for all
		mockGetExistingUrls.mockReturnValue(
			new Set([
				"https://example.com/article-1",
				"https://example.com/article-2",
			]),
		);

		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			5,
			mockMetadataStore as MetadataStore,
			false, // skipExistingUrls disabled
		);

		// Should not check existence when skipping is disabled
		expect(mockGetExistingUrls).not.toHaveBeenCalled();
		expect(mockExistsByUrl).not.toHaveBeenCalled();

		// Should create 2 pages (for both items)
		expect(mockPage.browser().newPage).toHaveBeenCalledTimes(2);
	});

	it("should process all URLs when no metadata store is provided", async () => {
		const config = createTestConfig();
		const items = createTestItems([
			"https://example.com/article-1",
			"https://example.com/article-2",
		]);

		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			5,
			undefined, // No metadata store
			true, // skipExistingUrls enabled but no store
		);

		// Should create 2 pages (for both items)
		expect(mockPage.browser().newPage).toHaveBeenCalledTimes(2);
	});

	it("should return early when all URLs are already in database", async () => {
		const config = createTestConfig();
		const items = createTestItems([
			"https://example.com/article-1",
			"https://example.com/article-2",
		]);

		// Mock metadata store to return all URLs as existing
		mockGetExistingUrls.mockReturnValue(
			new Set([
				"https://example.com/article-1",
				"https://example.com/article-2",
			]),
		);

		const detailErrors: string[] = [];
		const detailFieldStats: FieldExtractionStats[] = [];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await extractor.extractDetailData(
			mockPage,
			items,
			config,
			detailErrors,
			detailFieldStats,
			0,
			5,
			mockMetadataStore as MetadataStore,
			true, // skipExistingUrls enabled
		);

		// Should have called the batch method once
		expect(mockGetExistingUrls).toHaveBeenCalledTimes(1);
		expect(mockGetExistingUrls).toHaveBeenCalledWith([
			"https://example.com/article-1",
			"https://example.com/article-2",
		]);

		// Should not have called individual existsByUrl
		expect(mockExistsByUrl).not.toHaveBeenCalled();

		// Should log that all URLs are being skipped
		expect(consoleSpy).toHaveBeenCalledWith(
			"🎯 All URLs already exist in database, skipping detail extraction",
		);

		// Should not create any pages
		expect(mockPage.browser().newPage).not.toHaveBeenCalled();

		consoleSpy.mockRestore();
	});
});
