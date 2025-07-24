import { describe, expect, it } from "vitest";
import { CrawlerError } from "../core/types.js";

describe("CrawlerError", () => {
	it("should create error with all properties", () => {
		const originalError = new Error("Original error");
		const crawlerError = new CrawlerError(
			"Test error message",
			"test-source",
			originalError,
		);

		expect(crawlerError.message).toBe("Test error message");
		expect(crawlerError.source).toBe("test-source");
		expect(crawlerError.originalError).toBe(originalError);
		expect(crawlerError.name).toBe("CrawlerError");
	});

	it("should work without optional parameters", () => {
		const crawlerError = new CrawlerError("Test error message");

		expect(crawlerError.message).toBe("Test error message");
		expect(crawlerError.source).toBeUndefined();
		expect(crawlerError.originalError).toBeUndefined();
		expect(crawlerError.name).toBe("CrawlerError");
	});
});
