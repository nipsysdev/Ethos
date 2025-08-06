import type { Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { PaginationHandler } from "@/crawlers/handlers/PaginationHandler.js";

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
		type: CRAWLER_TYPES.LISTING,
		listing: {
			url: "https://example.com",
			items: {
				container_selector: ".article",
				fields: {
					title: { selector: ".title", attribute: "text" },
				},
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
		};
		return { ...defaultMocks, ...overrides } as unknown as Page;
	};

	it("should navigate to next page successfully with URL change", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton), // Button exists
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi.fn().mockResolvedValue(undefined),
			waitForSelector: vi.fn().mockResolvedValue(undefined),
			url: vi
				.fn()
				.mockReturnValueOnce("https://example.com/page/1") // Initial URL
				.mockReturnValueOnce("https://example.com/page/2"), // After navigation
		});

		const promise = handler.navigateToNextPage(mockPage, mockConfig);

		// Fast-forward through all timers
		await vi.runAllTimersAsync();

		const result = await promise;

		expect(result).toBe(true);
		expect(mockButton.click).toHaveBeenCalled();
		expect(mockPage.waitForSelector).toHaveBeenCalledWith(".article", {
			timeout: 10000, // Updated timeout
		});
		expect(mockPage.waitForNavigation).toHaveBeenCalledWith({
			waitUntil: "domcontentloaded",
			timeout: 8000, // Updated timeout
		});
	});

	it("should handle AJAX pagination (no URL change but content loads)", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi.fn().mockRejectedValue(new Error("No navigation")),
			waitForSelector: vi.fn().mockResolvedValue(undefined), // Container loads
			url: vi.fn().mockReturnValue("https://example.com/ajax-page"), // Same URL
		});

		const promise = handler.navigateToNextPage(mockPage, mockConfig);

		// Fast-forward through all timers
		await vi.runAllTimersAsync();

		const result = await promise;

		expect(result).toBe(true);
		expect(mockButton.click).toHaveBeenCalled();
		expect(mockPage.waitForSelector).toHaveBeenCalled();
	});
});
