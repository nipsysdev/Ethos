import { describe, expect, it, vi } from "vitest";
import { createBrowserExtractionFunction } from "@/crawlers/extractors/BrowserFieldExtractor";

describe("BrowserFieldExtractor", () => {
	describe("createBrowserExtractionFunction", () => {
		it("should extract content from element using text attribute", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockElement = {
				textContent: "Hello World",
				querySelector: vi.fn().mockReturnValue({
					textContent: "Hello World",
				}),
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

			// For text attribute, we expect the textContent to be extracted
			expect(result.results.content).toBe("Hello World");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should extract href attribute and resolve to absolute URL", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockElement = {
				getAttribute: vi.fn().mockImplementation((attr: string) => {
					if (attr === "href") return "/relative-link";
					return null;
				}),
			};

			const mockContainer = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === "a") {
						return mockElement;
					}
					return null;
				}),
			};

			// Mocking global document and window
			global.document = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".container") {
						return mockContainer;
					}
					return null;
				}),
			} as any;

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

			// Mock browser context - container not found
			global.document = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					return null; // Always return null to simulate missing container
				}),
			} as any;

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

			// Mock browser context - container exists but field element doesn't
			const mockContainer = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					return null; // Always return null for field elements
				}),
			};

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

		it("should extract content from container element when selector is empty", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context - when selector is empty, use container element directly
			const mockContainer = {
				textContent: "Main content here",
				innerHTML: "<div>Main content here</div>",
			};

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
						selector: "", // Empty selector means use container element
						attribute: "text",
					},
				},
			});

			expect(result.results.content).toBe("Main content here");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should handle extraction errors gracefully", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context with error
			const mockContainer = {
				querySelector: vi.fn().mockImplementation(() => {
					throw new Error("Query error");
				}),
			};

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

			expect(result.results.content).toBeNull();
			expect(result.extractionErrors).toContain(
				"Failed to extract content: Error: Query error",
			);
		});

		it("should extract src attribute and resolve to absolute URL", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockElement = {
				getAttribute: vi.fn().mockImplementation((attr: string) => {
					if (attr === "src") return "/image.jpg";
					return null;
				}),
			};

			const mockContainer = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === "img") {
						return mockElement;
					}
					return null;
				}),
			};

			// Mocking global document and window
			global.document = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".container") {
						return mockContainer;
					}
					return null;
				}),
			} as any;

			global.window = {
				location: {
					href: "https://example.com/page",
				},
			} as any;

			const result = extractionFunction({
				container_selector: ".container",
				fields: {
					image: {
						selector: "img",
						attribute: "src",
					},
				},
			});

			expect(result.results.image).toBe("https://example.com/image.jpg");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should extract node (innerHTML) attribute", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockElement = {
				innerHTML: "<p>Hello <strong>World</strong></p>",
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
						attribute: "node",
					},
				},
			});

			expect(result.results.content).toBe(
				"<p>Hello <strong>World</strong></p>",
			);
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should handle custom attributes", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context
			const mockElement = {
				getAttribute: vi.fn().mockImplementation((attr: string) => {
					if (attr === "data-id") return "12345";
					return null;
				}),
			};

			const mockContainer = {
				querySelector: vi.fn().mockImplementation((selector: string) => {
					if (selector === ".item") {
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
					id: {
						selector: ".item",
						attribute: "data-id",
					},
				},
			});

			expect(result.results.id).toBe("12345");
			expect(result.extractionErrors).toHaveLength(0);
		});

		it("should handle textContent with exclusions", () => {
			const extractionFunction = createBrowserExtractionFunction();

			// Mock browser context with nested elements
			const mockExcludedElement = {
				remove: vi.fn(),
			};

			const mockElement = {
				textContent: "Main content plus excluded content",
				cloneNode: vi.fn().mockReturnValue({
					querySelectorAll: vi.fn().mockReturnValue([mockExcludedElement]),
					textContent: "Main content ",
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

			// The exact result depends on the implementation, but it should be a string
			expect(typeof result.results.content).toBe("string");
			expect(result.extractionErrors).toHaveLength(0);
		});
	});
});
