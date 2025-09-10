import { describe, expect, it } from "vitest";
import { createBrowserExtractionFunction } from "@/crawlers/extractors/BrowserFieldExtractor";

describe("BrowserFieldExtractor", () => {
	describe("createBrowserExtractionFunction", () => {
		it("should extract content from element using text attribute", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockDocument = {
				querySelector: (selector: string) => {
					if (selector === ".container") {
						return {
							querySelector: (fieldSelector: string) => {
								if (fieldSelector === ".content") {
									return {
										innerHTML: "<p>Hello World</p>",
									};
								}
								return null;
							},
						};
					}
					return null;
				},
			};

			// Mocking global document
			global.document = mockDocument as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					content: {
						selector: ".content",
						attribute: "text",
					},
				},
			});

			expect(result.results.content).toBe("<p>Hello World</p>");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should extract href attribute and resolve to absolute URL", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockDocument = {
				querySelector: (selector: string) => {
					if (selector === ".container") {
						return {
							querySelector: (fieldSelector: string) => {
								if (fieldSelector === "a") {
									return {
										getAttribute: (attr: string) => {
											if (attr === "href") return "/relative-link";
											return null;
										},
									};
								}
								return null;
							},
						};
					}
					return null;
				},
			};

			// Mocking global document and window
			global.document = mockDocument as any;
			global.window = {
				location: {
					href: "https://example.com/page",
				},
			} as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					link: {
						selector: "a",
						attribute: "href",
					},
				},
			});

			expect(result.results.link).toBe("https://example.com/relative-link");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should handle missing container selector", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockDocument = {
				querySelector: (selector: string) => null,
			};

			// Mocking global document
			global.document = mockDocument as any;

			const result = extractionFunction({
				container_selector: ".nonexistent",
				fields: {
					content: {
						selector: ".content",
						attribute: "text",
					},
				},
			});

			expect(result.results).toEqual({});
			expect(result.extractionErrors).toContain(
				'Container selector ".nonexistent" not found',
			);
		});

		it("should handle missing field element", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockDocument = {
				querySelector: (selector: string) => {
					if (selector === ".container") {
						return {
							querySelector: () => null,
						};
					}
					return null;
				},
			};

			// Mocking global document
			global.document = mockDocument as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					missing: {
						selector: ".missing",
						attribute: "text",
					},
				},
			});

			expect(result.results.missing).toBeNull();
			expect(result.extractionErrors).toContain(
				"Required field 'missing' not found: selector '.missing' returned no results",
			);
		});

		it("should handle optional missing field without error", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockDocument = {
				querySelector: (selector: string) => {
					if (selector === ".container") {
						return {
							querySelector: () => null,
						};
					}
					return null;
				},
			};

			// Mocking global document
			global.document = mockDocument as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					optional: {
						selector: ".missing",
						attribute: "text",
						optional: true,
					},
				},
			});

			expect(result.results.optional).toBeNull();
			expect(result.extractionErrors).toContain(
				"Optional field 'optional' not found: selector '.missing' returned no results",
			);
		});

		it("should extract content from container element when selector is empty", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockDocument = {
				querySelector: (selector: string) => {
					if (selector === ".container") {
						return {
							innerHTML: "<div>Main content here</div>",
						};
					}
					return null;
				},
			};

			// Mocking global document
			global.document = mockDocument as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					content: {
						selector: "",
						attribute: "text",
					},
				},
			});

			expect(result.results.content).toBe("<div>Main content here</div>");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should handle extraction errors gracefully", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context with error
			const mockDocument = {
				querySelector: (selector: string) => {
					if (selector === ".container") {
						return {
							querySelector: () => {
								throw new Error("Query error");
							},
						};
					}
					return null;
				},
			};

			// Mocking global document
			global.document = mockDocument as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					content: {
						selector: ".content",
						attribute: "text",
					},
				},
			});

			expect(result.results.content).toBeNull();
			expect(result.extractionErrors).toContain(
				"Failed to extract content: Error: Query error",
			);
		});
	});
});
