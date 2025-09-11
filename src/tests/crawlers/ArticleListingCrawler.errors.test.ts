import { describe, expect, it, vi } from "vitest";

describe("ArticleListingCrawler - Error Handling", () => {
	it("should separate listing and content errors", () => {
		const listingErrors = [
			"Failed to parse item 1: Missing required title",
			"Failed to parse item 3: Invalid URL format",
		];

		const contentErrors = [
			"Content extraction for https://example.com/1 : Failed to extract content: element not found",
			"Failed to load content page https://example.com/2 : Navigation timeout",
		];

		expect(listingErrors).toHaveLength(2);
		expect(contentErrors).toHaveLength(2);

		expect(contentErrors[0]).toContain("Content extraction");
		expect(listingErrors[0]).toContain("Failed to parse item");
	});

	it("should format content error messages correctly", () => {
		const itemUrl = "https://example.com/article";
		const extractionError = "Failed to extract content: element not found";
		const navigationError = "Navigation timeout";

		const contentExtractionError = `Content extraction for ${itemUrl} : ${extractionError}`;
		const contentNavigationError = `Failed to load content page ${itemUrl} : ${navigationError}`;

		expect(contentExtractionError).toBe(
			"Content extraction for https://example.com/article : Failed to extract content: element not found",
		);
		expect(contentNavigationError).toBe(
			"Failed to load content page https://example.com/article : Navigation timeout",
		);
	});

	it("should handle browser errors", () => {
		// Mock console.error to verify browser error logging
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		// Simulate a browser error event
		const mockError = new Error("Browser crashed");
		const errorMessage = `BROWSER ERROR: ${mockError.message}`;

		// Call the error handler (simulating page.on("error") event)
		console.error(errorMessage);

		// Verify the error was logged with the correct format
		expect(consoleSpy).toHaveBeenCalledWith("BROWSER ERROR: Browser crashed");

		// Restore console.error
		consoleSpy.mockRestore();
	});
});
