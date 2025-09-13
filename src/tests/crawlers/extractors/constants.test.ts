import { describe, expect, it } from "vitest";
import {
	DYNAMIC_CONTENT_TIMEOUT,
	EXTRACTION_CONCURRENCY,
	EXTRACTION_TIMEOUTS,
} from "@/crawlers/extractors/constants.js";

describe("extraction constants", () => {
	describe("EXTRACTION_TIMEOUTS", () => {
		it("should have reasonable timeout values", () => {
			expect(EXTRACTION_TIMEOUTS.DYNAMIC_CONTENT_MS).toBe(20000);
		});
	});

	describe("EXTRACTION_CONCURRENCY", () => {
		it("should have reasonable concurrency limits", () => {
			expect(EXTRACTION_CONCURRENCY.DEFAULT_LIMIT).toBe(5);
			expect(EXTRACTION_CONCURRENCY.HIGH_PERFORMANCE_LIMIT).toBe(8);
		});
	});

	describe("backward compatibility", () => {
		it("should maintain DYNAMIC_CONTENT_TIMEOUT for legacy code", () => {
			expect(DYNAMIC_CONTENT_TIMEOUT).toBe(20000);
		});
	});
});
