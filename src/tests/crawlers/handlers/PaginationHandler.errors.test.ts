import type { Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CrawlerType } from "@/core/types.js";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler - Error Handling", () => {
	// Mock timers for all tests to avoid real delays
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const mockConfig: SourceConfig = {
		id: "test",
		name: "Test Source",
		type: CrawlerType.Listing,
		listing: {
			url: "https://example.com",
			container_selector: ".article",
			fields: {
				title: { selector: ".title", attribute: "text" },
			},
			pagination: {
				next_button_selector: ".next-page",
			},
		},
		content: {
			container_selector: ".article-content",
			fields: {
				content: { selector: ".content", attribute: "text" },
			},
		},
	};

	// Helper to create a mock page with common behavior
	const createMockPage = (overrides: Partial<Page> = {}) => {
		const defaultMocks = {
			$: vi.fn(),
			evaluate: vi.fn(),
			waitForNavigation: vi.fn(),
			waitForSelector: vi.fn(),
			url: vi.fn(),
			reload: vi.fn(),
		};
		return { ...defaultMocks, ...overrides } as unknown as Page;
	};

	it("should handle page query errors gracefully", async () => {
		const mockPage = createMockPage({
			$: vi.fn().mockRejectedValue(new Error("Page query failed")),
		});

		const promise = navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
	});

	it("should handle evaluate errors gracefully", async () => {
		const mockButton = { click: vi.fn() };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockRejectedValue(new Error("Evaluate failed")),
		});

		const promise = navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
	});

	it("should handle button click errors gracefully", async () => {
		const mockButton = {
			click: vi.fn().mockRejectedValue(new Error("Click failed")),
		};
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false),
		});

		const promise = navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
	});

	it("should handle missing pagination configuration", async () => {
		const configNoSelector: SourceConfig = {
			...mockConfig,
			listing: {
				...mockConfig.listing,
				pagination: {
					next_button_selector: "", // Empty selector
				},
			},
		};

		const mockPage = createMockPage();

		const promise = navigateToNextPage(mockPage, configNoSelector);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
	});

	it("should handle completely missing pagination object", async () => {
		const configNoPagination: SourceConfig = {
			...mockConfig,
			listing: {
				...mockConfig.listing,
				pagination: undefined,
			},
		};

		const mockPage = createMockPage();

		const promise = navigateToNextPage(mockPage, configNoPagination);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
	});
});
