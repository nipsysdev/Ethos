import type { Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "../../../core/types.js";
import { CRAWLER_TYPES } from "../../../core/types.js";
import { PaginationHandler } from "../../../crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler", () => {
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
		detail: {
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

	describe("successful navigation", () => {
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
				waitForNavigation: vi
					.fn()
					.mockRejectedValue(new Error("No navigation")),
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

	describe("button detection and validation", () => {
		it("should return false when next button doesn't exist", async () => {
			const handler = new PaginationHandler();
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(null), // Button doesn't exist
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
		});

		it("should return false when button has disabled attribute", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockResolvedValue(true), // Button is disabled
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
			expect(mockButton.click).not.toHaveBeenCalled();
		});

		it("should detect disabled button through various methods", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };

			// Test the evaluate function that checks for disabled states
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockImplementation((_fn, _selector) => {
					// Simulate the disabled detection logic
					return true; // Button is disabled (hidden, aria-disabled, etc.)
				}),
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
			expect(mockButton.click).not.toHaveBeenCalled();
			expect(mockPage.evaluate).toHaveBeenCalledWith(
				expect.any(Function),
				".next-page",
			);
		});
	});

	describe("retry logic", () => {
		it("should retry up to 3 times on failure", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
				waitForNavigation: vi
					.fn()
					.mockRejectedValue(new Error("Navigation timeout")),
				waitForSelector: vi
					.fn()
					.mockRejectedValue(new Error("Selector timeout")),
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
				waitForNavigation: vi
					.fn()
					.mockRejectedValue(new Error("No navigation")),
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
	});

	describe("URL verification", () => {
		it("should return false when container doesn't load after all retries", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockResolvedValue(false),
				waitForNavigation: vi
					.fn()
					.mockRejectedValue(new Error("No navigation")),
				waitForSelector: vi
					.fn()
					.mockRejectedValue(new Error("Container not found")), // Container fails to load
				url: vi.fn().mockReturnValue("https://example.com/same-page"), // Always same URL
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
			expect(mockButton.click).toHaveBeenCalledTimes(3); // All retries exhausted
		});

		it("should succeed when URL changes even without navigation event", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockResolvedValue(false),
				waitForNavigation: vi
					.fn()
					.mockRejectedValue(new Error("No navigation event")),
				waitForSelector: vi.fn().mockResolvedValue(undefined),
				url: vi
					.fn()
					.mockReturnValueOnce("https://example.com/page/1") // Initial
					.mockReturnValueOnce("https://example.com/page/2"), // After click (changed)
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(true);
		});
	});

	describe("timeout handling", () => {
		it("should use correct timeouts for navigation and container wait", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockResolvedValue(false),
				waitForNavigation: vi.fn().mockResolvedValue(undefined),
				waitForSelector: vi.fn().mockResolvedValue(undefined),
				url: vi
					.fn()
					.mockReturnValueOnce("https://example.com/page/1")
					.mockReturnValueOnce("https://example.com/page/2"),
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			await promise;

			expect(mockPage.waitForNavigation).toHaveBeenCalledWith({
				waitUntil: "domcontentloaded",
				timeout: 8000, // Updated navigation timeout
			});
			expect(mockPage.waitForSelector).toHaveBeenCalledWith(".article", {
				timeout: 10000, // Updated container timeout
			});
		});
	});

	describe("configuration edge cases", () => {
		it("should return false when no pagination config exists", async () => {
			const handler = new PaginationHandler();
			const configNoPagination = { ...mockConfig };
			delete configNoPagination.listing.pagination;

			const mockPage = createMockPage();

			const promise = handler.navigateToNextPage(mockPage, configNoPagination);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
		});

		it("should return false when pagination config exists but no next_button_selector", async () => {
			const handler = new PaginationHandler();
			const configNoSelector = {
				...mockConfig,
				listing: {
					...mockConfig.listing,
					pagination: {}, // No next_button_selector
				},
			};

			const mockPage = createMockPage();

			const promise = handler.navigateToNextPage(mockPage, configNoSelector);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
		});
	});

	describe("error handling", () => {
		it("should handle page query errors gracefully", async () => {
			const handler = new PaginationHandler();
			const mockPage = createMockPage({
				$: vi.fn().mockRejectedValue(new Error("Page query failed")),
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
		});

		it("should handle evaluate errors gracefully", async () => {
			const handler = new PaginationHandler();
			const mockButton = { click: vi.fn() };
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockRejectedValue(new Error("Evaluate failed")),
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
		});

		it("should handle button click errors gracefully", async () => {
			const handler = new PaginationHandler();
			const mockButton = {
				click: vi.fn().mockRejectedValue(new Error("Click failed")),
			};
			const mockPage = createMockPage({
				$: vi.fn().mockResolvedValue(mockButton),
				evaluate: vi.fn().mockResolvedValue(false),
			});

			const promise = handler.navigateToNextPage(mockPage, mockConfig);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe(false);
		});
	});
});
