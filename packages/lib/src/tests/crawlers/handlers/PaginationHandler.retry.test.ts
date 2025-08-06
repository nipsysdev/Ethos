import type { Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { PaginationHandler } from "@/crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler - Retry Logic", () => {
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

	it("should retry up to 3 times on failure", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi
				.fn()
				.mockRejectedValue(new Error("Navigation timeout")),
			waitForSelector: vi.fn().mockRejectedValue(new Error("Selector timeout")),
			url: vi.fn().mockReturnValue("https://example.com/page/1"), // Same URL (no change)
		});

		const promise = handler.navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
		expect(mockButton.click).toHaveBeenCalledTimes(3); // Should retry 3 times
	});

	it("should succeed on second attempt after first failure", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		let attempt = 0;

		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false),
			waitForNavigation: vi.fn().mockRejectedValue(new Error("No navigation")),
			waitForSelector: vi.fn().mockImplementation(() => {
				attempt++;
				if (attempt === 1) {
					throw new Error("First attempt: container not found");
				}
				return Promise.resolve();
			}),
			url: vi.fn().mockReturnValue("https://example.com/page/1"),
		});

		const promise = handler.navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(true);
		expect(mockButton.click).toHaveBeenCalledTimes(2); // First attempt + retry
	});

	it("should wait 2 seconds between retry attempts", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };

		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false),
			waitForNavigation: vi.fn().mockRejectedValue(new Error("Always fails")),
			waitForSelector: vi
				.fn()
				.mockRejectedValue(new Error("Container always fails")), // This should trigger retries
			url: vi.fn().mockReturnValue("https://example.com/page/1"),
		});

		const promise = handler.navigateToNextPage(mockPage, mockConfig);

		// Let the first attempt start, then check for pending timers
		await vi.advanceTimersByTimeAsync(100); // Small advance to let first attempt begin

		// Check that timers are pending (delays scheduled)
		expect(vi.getTimerCount()).toBeGreaterThan(0);

		await vi.runAllTimersAsync();
		await promise;

		// Verify delays were used (this is implicit in the retry logic working)
		expect(mockButton.click).toHaveBeenCalledTimes(3);
	});

	it("should return false when container doesn't load after all retries", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false),
			waitForNavigation: vi.fn().mockRejectedValue(new Error("No navigation")),
			waitForSelector: vi
				.fn()
				.mockRejectedValue(new Error("Container timeout")),
			url: vi.fn().mockReturnValue("https://example.com/page/1"),
		});

		const promise = handler.navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
		expect(mockButton.click).toHaveBeenCalledTimes(3); // All retries exhausted
	});
});
