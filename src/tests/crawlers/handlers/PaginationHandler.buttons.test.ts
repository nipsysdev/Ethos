import type { Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler - Button Detection", () => {
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
			reload: vi.fn(),
		};
		return { ...defaultMocks, ...overrides } as unknown as Page;
	};

	it("should return false when next button doesn't exist", async () => {
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(null), // Button doesn't exist
		});

		const promise = navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
	});

	it("should return false when button has disabled attribute", async () => {
		const mockButton = { click: vi.fn(), isVisible: true };
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockImplementation((fn, selector) => {
				// Simulate the disabled detection logic
				if (selector === ".next-page") {
					return true; // Button is disabled
				}
				return false;
			}),
		});

		const promise = navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
		expect(mockButton.click).not.toHaveBeenCalled();
	});

	it("should detect disabled button through various methods", async () => {
		const mockButton = { click: vi.fn(), isVisible: true };

		// Test the evaluate function that checks for disabled states
		const mockPage = createMockPage({
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockImplementation((fn, selector) => {
				// Simulate the disabled detection logic
				// This should match the implementation in PaginationHandler.ts
				if (selector === ".next-page") {
					// Simulate that the button is disabled
					return true; // Button is disabled (hidden, aria-disabled, etc.)
				}
				return false;
			}),
		});

		const promise = navigateToNextPage(mockPage, mockConfig);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe(false);
		expect(mockButton.click).not.toHaveBeenCalled();
		expect(mockPage.evaluate).toHaveBeenCalledWith(
			expect.any(Function),
			".next-page",
		);
	});

	it("should return false when no pagination config is provided", async () => {
		const configWithoutPagination: SourceConfig = {
			...mockConfig,
			listing: {
				...mockConfig.listing,
				pagination: undefined,
			},
		};

		const mockPage = createMockPage();

		const result = await navigateToNextPage(mockPage, configWithoutPagination);

		expect(result).toBe(false);
	});
});
