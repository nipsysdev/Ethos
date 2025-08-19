import type { Browser, Page } from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CrawledData,
	FieldExtractionStats,
	SourceConfig,
} from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { createConcurrentContentExtractor } from "@/crawlers/extractors/ConcurrentContentExtractor.js";
import type { MetadataStore } from "@/storage/MetadataStore.js";

describe("ConcurrentContentExtractor", () => {
	let mockExtractContentForSingleItem: ReturnType<typeof vi.fn>;
	let concurrentExtractor: ReturnType<typeof createConcurrentContentExtractor>;
	let mockPage: Page;
	let mockBrowser: Browser;
	let mockMetadataStore: MetadataStore;

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

	const mockItems: CrawledData[] = [
		{
			url: "https://example.com/article1",
			title: "Article 1",
			content: "Content 1",
			crawledAt: new Date(),
			source: "test",
			metadata: {},
		},
		{
			url: "https://example.com/article2",
			title: "Article 2",
			content: "Content 2",
			crawledAt: new Date(),
			source: "test",
			metadata: {},
		},
	];

	beforeEach(() => {
		// Create mock extractContentForSingleItem function
		mockExtractContentForSingleItem = vi.fn().mockResolvedValue(undefined);

		// Create mock browser and pages
		const mockNewPage = vi.fn().mockResolvedValue({
			close: vi.fn().mockResolvedValue(undefined),
		});

		mockBrowser = {
			newPage: mockNewPage,
		} as unknown as Browser;

		mockPage = {
			browser: () => mockBrowser,
		} as unknown as Page;

		// Create mock metadata store
		mockMetadataStore = {
			getExistingUrls: vi.fn().mockReturnValue(new Set()),
		} as unknown as MetadataStore;

		concurrentExtractor = createConcurrentContentExtractor({
			extractContentForSingleItem: mockExtractContentForSingleItem,
		});
	});

	describe("extractConcurrently", () => {
		it("should handle empty items list", async () => {
			await concurrentExtractor.extractConcurrently(
				mockPage,
				[],
				mockConfig,
				0,
				{
					concurrencyLimit: 2,
					skipExistingUrls: true,
					metadataStore: mockMetadataStore,
				},
			);

			expect(mockExtractContentForSingleItem).not.toHaveBeenCalled();
		});

		it("should filter out existing URLs when skipExistingUrls is true", async () => {
			const existingUrls = new Set(["https://example.com/article1"]);
			vi.mocked(mockMetadataStore.getExistingUrls).mockReturnValue(
				existingUrls,
			);

			const mockTracker = {
				addDuplicatesSkipped: vi.fn(),
				addUrlsExcluded: vi.fn(),
			};

			await concurrentExtractor.extractConcurrently(
				mockPage,
				mockItems,
				mockConfig,
				0,
				{
					concurrencyLimit: 2,
					skipExistingUrls: true,
					metadataStore: mockMetadataStore,
					metadataTracker: mockTracker,
				},
			);

			expect(mockTracker.addDuplicatesSkipped).toHaveBeenCalledWith(1);
			expect(mockExtractContentForSingleItem).toHaveBeenCalledTimes(1);
		});

		it("should not filter URLs when skipExistingUrls is false", async () => {
			await concurrentExtractor.extractConcurrently(
				mockPage,
				mockItems,
				mockConfig,
				0,
				{
					concurrencyLimit: 2,
					skipExistingUrls: false,
					metadataStore: mockMetadataStore,
				},
			);

			expect(mockMetadataStore.getExistingUrls).not.toHaveBeenCalled();
			expect(mockExtractContentForSingleItem).toHaveBeenCalledTimes(2);
		});

		it("should respect concurrency limit", async () => {
			const mockNewPage = vi
				.fn()
				.mockResolvedValueOnce({ close: vi.fn() })
				.mockResolvedValueOnce({ close: vi.fn() });

			mockBrowser = {
				newPage: mockNewPage,
			} as unknown as Browser;

			mockPage = {
				browser: () => mockBrowser,
			} as unknown as Page;

			await concurrentExtractor.extractConcurrently(
				mockPage,
				mockItems,
				mockConfig,
				0,
				{
					concurrencyLimit: 2,
					skipExistingUrls: false,
				},
			);

			// Should create exactly 2 pages for concurrency limit of 2
			expect(mockNewPage).toHaveBeenCalledTimes(2);
		});

		it("should limit pages to actual item count", async () => {
			const mockNewPage = vi.fn().mockResolvedValueOnce({ close: vi.fn() });

			mockBrowser = {
				newPage: mockNewPage,
			} as unknown as Browser;

			mockPage = {
				browser: () => mockBrowser,
			} as unknown as Page;

			await concurrentExtractor.extractConcurrently(
				mockPage,
				[mockItems[0]], // Only 1 item
				mockConfig,
				0,
				{
					concurrencyLimit: 5, // Higher than item count
					skipExistingUrls: false,
				},
			);

			// Should create only 1 page for 1 item, not 5
			expect(mockNewPage).toHaveBeenCalledTimes(1);
		});

		it("should call extractContentForSingleItem with correct parameters", async () => {
			const mockContentErrors: string[] = [];
			const mockContentFieldStats: FieldExtractionStats[] = [];

			await concurrentExtractor.extractConcurrently(
				mockPage,
				[mockItems[0]],
				mockConfig,
				10, // offset
				{
					concurrencyLimit: 1,
					skipExistingUrls: false,
					externalContentErrors: mockContentErrors,
					externalContentFieldStats: mockContentFieldStats,
				},
			);

			expect(mockExtractContentForSingleItem).toHaveBeenCalledWith(
				expect.any(Object), // page
				mockItems[0], // item
				mockConfig, // config
				mockContentErrors, // contentErrors
				mockContentFieldStats, // contentFieldStats
				10, // itemOffset + currentIndex (10 + 0)
			);
		});

		it("should close all created pages after processing", async () => {
			const mockPages = [
				{ close: vi.fn().mockResolvedValue(undefined) },
				{ close: vi.fn().mockResolvedValue(undefined) },
			];

			const mockNewPage = vi
				.fn()
				.mockResolvedValueOnce(mockPages[0])
				.mockResolvedValueOnce(mockPages[1]);

			mockBrowser = {
				newPage: mockNewPage,
			} as unknown as Browser;

			mockPage = {
				browser: () => mockBrowser,
			} as unknown as Page;

			await concurrentExtractor.extractConcurrently(
				mockPage,
				mockItems,
				mockConfig,
				0,
				{
					concurrencyLimit: 2,
					skipExistingUrls: false,
				},
			);

			expect(mockPages[0].close).toHaveBeenCalled();
			expect(mockPages[1].close).toHaveBeenCalled();
		});
	});
});
