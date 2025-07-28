import { describe, expect, it } from "vitest";
import { resolveAbsoluteUrl } from "../utils/url.js";

describe("URL Utilities", () => {
	describe("resolveAbsoluteUrl", () => {
		it("should return absolute URLs unchanged", () => {
			const absoluteUrl = "https://example.com/article/123";
			const baseUrl = "https://example.com";

			const result = resolveAbsoluteUrl(absoluteUrl, baseUrl);
			expect(result).toBe(absoluteUrl);
		});

		it("should resolve relative URLs to absolute URLs", () => {
			const relativeUrl = "/article/123";
			const baseUrl = "https://example.com/news";

			const result = resolveAbsoluteUrl(relativeUrl, baseUrl);
			expect(result).toBe("https://example.com/article/123");
		});

		it("should handle different base URL formats", () => {
			// Base URL with trailing slash
			let result = resolveAbsoluteUrl("/page", "https://example.com/");
			expect(result).toBe("https://example.com/page");

			// Base URL without trailing slash
			result = resolveAbsoluteUrl("/page", "https://example.com");
			expect(result).toBe("https://example.com/page");

			// Base URL with path
			result = resolveAbsoluteUrl("../page", "https://example.com/news/");
			expect(result).toBe("https://example.com/page");
		});

		it("should handle protocol-relative URLs", () => {
			const protocolRelativeUrl = "//cdn.example.com/image.jpg";
			const baseUrl = "https://example.com";

			const result = resolveAbsoluteUrl(protocolRelativeUrl, baseUrl);
			expect(result).toBe("https://cdn.example.com/image.jpg");
		});

		it("should preserve query parameters and fragments", () => {
			const relativeUrl = "/search?q=test&page=2#results";
			const baseUrl = "https://example.com";

			const result = resolveAbsoluteUrl(relativeUrl, baseUrl);
			expect(result).toBe("https://example.com/search?q=test&page=2#results");
		});
	});
});
