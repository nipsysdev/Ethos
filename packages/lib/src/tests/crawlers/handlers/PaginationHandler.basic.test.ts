import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaginationHandler } from "@/crawlers/handlers/PaginationHandler.js";

describe("PaginationHandler - Basic Setup", () => {
	// Mock timers for all tests to avoid real delays
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should create a pagination handler instance", () => {
		const handler = new PaginationHandler();
		expect(handler).toBeDefined();
		expect(typeof handler.navigateToNextPage).toBe("function");
	});

	it("should have proper default configuration", () => {
		const handler = new PaginationHandler();
		expect(handler).toBeInstanceOf(PaginationHandler);
	});
});
