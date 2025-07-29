import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "../../core/types.js";
import { CRAWLER_TYPES } from "../../core/types.js";
import { PaginationHandler } from "../../crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler", () => {
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
	};

	it("should navigate to next page successfully", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = {
			$: vi.fn().mockResolvedValue(mockButton), // Button exists
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi.fn().mockResolvedValue(undefined),
			waitForSelector: vi.fn().mockResolvedValue(undefined),
		} as unknown as Page;

		const result = await handler.navigateToNextPage(mockPage, mockConfig);

		expect(result).toBe(true);
		expect(mockButton.click).toHaveBeenCalled();
		expect(mockPage.waitForSelector).toHaveBeenCalledWith(".article", {
			timeout: 5000,
		});
	});

	it("should return false when next button doesn't exist", async () => {
		const handler = new PaginationHandler();
		const mockPage = {
			$: vi.fn().mockResolvedValue(null), // Button doesn't exist
		} as unknown as Page;

		const result = await handler.navigateToNextPage(mockPage, mockConfig);

		expect(result).toBe(false);
	});

	it("should return false when button is disabled", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = {
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(true), // Button is disabled
		} as unknown as Page;

		const result = await handler.navigateToNextPage(mockPage, mockConfig);

		expect(result).toBe(false);
		expect(mockButton.click).not.toHaveBeenCalled();
	});

	it("should handle navigation and selector failures gracefully", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = {
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi
				.fn()
				.mockRejectedValue(new Error("Navigation timeout")),
			waitForSelector: vi.fn().mockRejectedValue(new Error("Selector timeout")),
		} as unknown as Page;

		const result = await handler.navigateToNextPage(mockPage, mockConfig);

		expect(result).toBe(false);
		expect(mockButton.click).toHaveBeenCalled();
	});

	it("should handle AJAX pagination (no navigation)", async () => {
		const handler = new PaginationHandler();
		const mockButton = { click: vi.fn() };
		const mockPage = {
			$: vi.fn().mockResolvedValue(mockButton),
			evaluate: vi.fn().mockResolvedValue(false), // Button not disabled
			waitForNavigation: vi.fn().mockRejectedValue(new Error("No navigation")),
			waitForSelector: vi.fn().mockResolvedValue(undefined), // Container loads
		} as unknown as Page;

		const result = await handler.navigateToNextPage(mockPage, mockConfig);

		expect(result).toBe(true);
		expect(mockButton.click).toHaveBeenCalled();
		expect(mockPage.waitForSelector).toHaveBeenCalled();
	});

	it("should return false when no pagination config exists", async () => {
		const handler = new PaginationHandler();
		const configNoPagination = { ...mockConfig };
		delete configNoPagination.listing.pagination;

		const mockPage = {} as Page;

		const result = await handler.navigateToNextPage(
			mockPage,
			configNoPagination,
		);

		expect(result).toBe(false);
	});

	it("should handle errors gracefully and return false", async () => {
		const handler = new PaginationHandler();
		const mockPage = {
			$: vi.fn().mockRejectedValue(new Error("Page query failed")),
		} as unknown as Page;

		const result = await handler.navigateToNextPage(mockPage, mockConfig);

		expect(result).toBe(false);
	});
});
