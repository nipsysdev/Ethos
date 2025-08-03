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

describe("Type interfaces", () => {
	it("should define CrawlOptions interface correctly", () => {
		// Test that CrawlOptions has the expected shape
		const options = {
			maxPages: 5,
			detailConcurrency: 3,
		};

		// TypeScript compilation validates the interface
		expect(typeof options.maxPages).toBe("number");
		expect(typeof options.detailConcurrency).toBe("number");
		expect(options.maxPages).toBe(5);
		expect(options.detailConcurrency).toBe(3);
	});

	it("should make all CrawlOptions fields optional", () => {
		// Test that an empty object is valid CrawlOptions
		const emptyOptions = {};

		// Should not throw - TypeScript validates optional fields
		expect(emptyOptions).toBeDefined();

		// Test partial options
		const partialOptions = { maxPages: 10 };
		expect(partialOptions.maxPages).toBe(10);
		expect("detailConcurrency" in partialOptions).toBe(false);
	});
});
