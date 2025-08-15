import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigateToNextPage } from "@/crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler - Basic Setup", () => {
	// Mock timers for all tests to avoid real delays
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should export navigateToNextPage function", () => {
		expect(navigateToNextPage).toBeDefined();
		expect(typeof navigateToNextPage).toBe("function");
	});

	it("should have proper function signature", () => {
		// Check that the function is properly exported and has the right signature
		expect(navigateToNextPage.name).toBe("navigateToNextPage");
		expect(navigateToNextPage.length).toBe(2); // page, config parameters
	});
});
