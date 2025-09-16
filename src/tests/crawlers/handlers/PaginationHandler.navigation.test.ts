import type { Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CrawlerType } from "@/core/types.js";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler - Navigation", () => {
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

	it("should navigate to next page successfully with URL change", async () => {
		let urlState = "https://example.com/page/1";

		const mockButton = { click: vi.fn(), isVisible: true };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton), // Button exists
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi.fn().mockImplementation(() => {
				// After navigation, URL should change
				urlState = "https://example.com/page/2";
				return Promise.resolve();
			}),
			waitForSelector: vi.fn().mockResolvedValue(undefined),
			url: vi.fn().mockImplementation(() => urlState),
		});

		const promise = navigateToNextPage(mockPage, mockConfig);

		// Fast-forward through all timers
		await vi.runAllTimersAsync();

		const result = await promise;

		expect(result).toBe(true);
		expect(mockButton.click).toHaveBeenCalled();
		expect(mockPage.waitForSelector).toHaveBeenCalledWith(".article", {
			timeout: 20000, // Updated timeout to match optimized value
		});
		expect(mockPage.waitForNavigation).toHaveBeenCalledWith({
			waitUntil: "domcontentloaded",
			timeout: 5000, // Updated timeout to match optimized value
		});
	});
});
