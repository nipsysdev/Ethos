import { describe, expect, it, vi } from "vitest";
import { createBrowserExtractionFunction } from "@/crawlers/extractors/BrowserFieldExtractor";

describe("BrowserFieldExtractor - Whitespace handling", () => {
	describe("createBrowserExtractionFunction", () => {
		it("should normalize whitespace in extracted text", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context with text containing excessive whitespace
			const mockElement = {
				textContent: "  Hello    World  \n  \t  Test  ",
			};

			const mockContainer = {
				querySelector: vi.fn().mockReturnValue(mockElement),
			};

			// Mocking global document
			global.document = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".container") {
						return mockContainer;
					}
					return null;
				}),
			} as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					content: {
						selector: ".content",
						attribute: "text",
					},
				},
			});

			// Should normalize whitespace to single spaces
			expect(result.results.content).toBe("Hello World Test");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should normalize whitespace with exclusions", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context with text containing excessive whitespace
			const mockExcludedElement = {
				remove: vi.fn(),
			};

			const mockElement = {
				textContent: "  Main   content  \n  plus   \t  excluded  content  ",
				cloneNode: vi.fn().mockReturnValue({
					querySelectorAll: vi.fn().mockReturnValue([mockExcludedElement]),
					textContent: "  Main   content  \n  plus   \t  ",
					remove: mockExcludedElement.remove,
				}),
			};

			const mockContainer = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".content") {
						return mockElement;
					}
					return null;
				}),
			};

			// Mocking global document
			global.document = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".container") {
						return mockContainer;
					}
					return null;
				}),
			} as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					content: {
						selector: ".content",
						attribute: "text",
						exclude_selectors: [".exclude"],
					},
				},
			});

			// Should normalize whitespace to single spaces after exclusions
			expect(result.results.content).toBe("Main content plus");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should handle empty text after whitespace normalization as missing field", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context with only whitespace
			const mockElement = {
				textContent: "   \n  \t  \r  ",
			};

			const mockContainer = {
				querySelector: vi.fn().mockReturnValue(mockElement),
			};

			// Mocking global document
			global.document = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".container") {
						return mockContainer;
					}
					return null;
				}),
			} as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					content: {
						selector: ".content",
						attribute: "text",
						optional: true, // Make it optional to avoid failing the test
					},
				},
			});

			// Should return null for text that becomes empty after normalization
			expect(result.results.content).toBeNull();
			// Should have an extraction error for the missing field
			expect(result.extractionErrors).toHaveLength(1);
			expect(result.extractionErrors[0]).toContain(
				"Optional field 'content' not found",
			);
		});
	});
});
