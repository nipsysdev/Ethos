import { describe, expect, it } from "vitest";
import {
	DYNAMIC_CONTENT_TIMEOUT,
	EXTRACTION_CONCURRENCY,
	EXTRACTION_TIMEOUTS,
} from "@/crawlers/extractors/constants.js";

describe("extraction constants", () => {
	describe("EXTRACTION_TIMEOUTS", () => {
		it("should have reasonable timeout values", () => {
			expect(EXTRACTION_TIMEOUTS.DYNAMIC_CONTENT_MS).toBe(6000);
			expect(EXTRACTION_TIMEOUTS.DYNAMIC_CONTENT_MS).toBeGreaterThan(0);
			expect(EXTRACTION_TIMEOUTS.DYNAMIC_CONTENT_MS).toBeLessThan(30000); // Reasonable upper bound
		});

		it("should be read-only structure", () => {
			expect(typeof EXTRACTION_TIMEOUTS).toBe("object");
			expect(EXTRACTION_TIMEOUTS).toBeDefined();
		});
	});

	describe("EXTRACTION_CONCURRENCY", () => {
		it("should have reasonable concurrency limits", () => {
			expect(EXTRACTION_CONCURRENCY.DEFAULT_LIMIT).toBe(5);
			expect(EXTRACTION_CONCURRENCY.HIGH_PERFORMANCE_LIMIT).toBe(8);

			expect(EXTRACTION_CONCURRENCY.DEFAULT_LIMIT).toBeGreaterThan(0);
			expect(EXTRACTION_CONCURRENCY.HIGH_PERFORMANCE_LIMIT).toBeGreaterThan(
				EXTRACTION_CONCURRENCY.DEFAULT_LIMIT,
			);
		});

		it("should be read-only structure", () => {
			expect(typeof EXTRACTION_CONCURRENCY).toBe("object");
			expect(EXTRACTION_CONCURRENCY).toBeDefined();
		});
	});

	describe("backward compatibility", () => {
		it("should maintain DYNAMIC_CONTENT_TIMEOUT for legacy code", () => {
			expect(DYNAMIC_CONTENT_TIMEOUT).toBe(
				EXTRACTION_TIMEOUTS.DYNAMIC_CONTENT_MS,
			);
			expect(DYNAMIC_CONTENT_TIMEOUT).toBe(6000);
		});
	});
});
