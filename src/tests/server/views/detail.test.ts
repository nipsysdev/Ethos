import { describe, expect, it, vi } from "vitest";
import type { PublicationResponse } from "@/server/types";
import { renderDetail } from "@/server/views/detail.js";

// Mock PicoCSS
vi.mock("@/server/views/pico.classless.min", () => ({
	PicoCSS: "mocked-css",
}));

describe("Detail View", () => {
	it("should render detail view with publication data", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			author: "Test Author",
			publishedDate: "2023-01-01T00:00:00.000Z",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, {});

		// Assert
		expect(result).toContain("<html>");
		expect(result).toContain("<title>Ethos - Test Article</title>");
		expect(result).toContain("mocked-css");
		expect(result).toContain("<h1>Test Article</h1>");
		expect(result).toContain("<p>Test content</p>");
		expect(result).toContain("Test Author");
		expect(result).toContain("Published on");
		expect(result).toContain("Test Source");
		expect(result).toContain('href="https://example.com/article"');
	});

	it("should render detail view without author", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			publishedDate: "2023-01-01T00:00:00.000Z",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, {});

		// Assert
		expect(result).toContain("<html>");
		expect(result).toContain("<title>Ethos - Test Article</title>");
		expect(result).not.toContain("author");
		expect(result).toContain("<h1>Test Article</h1>");
	});

	it("should render detail view without published date", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			author: "Test Author",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, {});

		// Assert
		expect(result).toContain("<html>");
		expect(result).toContain("<title>Ethos - Test Article</title>");
		expect(result).not.toContain("Published on");
		expect(result).toContain("<h1>Test Article</h1>");
	});

	it("should render detail view with back link without query params", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			author: "Test Author",
			publishedDate: "2023-01-01T00:00:00.000Z",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, {});

		// Assert
		expect(result).toContain('<a href="/">← Back to Publications</a>');
	});

	it("should render detail view with back link with page param", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			author: "Test Author",
			publishedDate: "2023-01-01T00:00:00.000Z",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, { page: 2 });

		// Assert
		expect(result).toContain('<a href="/?page=2">← Back to Publications</a>');
	});

	it("should render detail view with back link with source param", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			author: "Test Author",
			publishedDate: "2023-01-01T00:00:00.000Z",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, { source: "test-source" });

		// Assert
		expect(result).toContain(
			'<a href="/?source=test-source">← Back to Publications</a>',
		);
	});

	it("should render detail view with back link with both page and source params", () => {
		// Setup
		const publication: PublicationResponse = {
			url: "https://example.com/article",
			title: "Test Article",
			content: "<p>Test content</p>",
			author: "Test Author",
			publishedDate: "2023-01-01T00:00:00.000Z",
			source: "Test Source",
			crawledAt: new Date("2023-01-02T00:00:00.000Z"),
			hash: "testhash123",
		};

		// Execute
		const result = renderDetail(publication, {
			page: 2,
			source: "test-source",
		});

		// Assert
		expect(result).toContain(
			'<a href="/?page=2&amp;source=test-source">← Back to Publications</a>',
		);
	});
});
