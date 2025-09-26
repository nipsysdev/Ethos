import { describe, expect, it, vi } from "vitest";
import type { PublicationResponse } from "@/server/types";
import type { PaginationMeta } from "@/server/utils/pagination";
import { renderListing } from "@/server/views/listing.js";

// Mock PicoCSS
vi.mock("@/server/views/pico.classless.min", () => ({
	PicoCSS: "mocked-css",
}));

describe("Listing View", () => {
	const mockSources = [
		{ id: "source1", name: "Source 1" },
		{ id: "source2", name: "Source 2" },
	];

	const mockPagination: PaginationMeta = {
		total: 2,
		page: 1,
		limit: 10,
		totalPages: 1,
	};

	it("should render listing view with publications", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
			{
				url: "https://example.com/article2",
				title: "Test Article 2",
				content: "<p>Test content 2</p>",
				author: "Test Author 2",
				publishedDate: "2023-01-03T00:00:00.000Z",
				source: "Source 2",
				crawledAt: new Date("2023-01-04T00:00:00.000Z"),
				hash: "testhash456",
			},
		];

		// Execute
		const result = renderListing(publications, mockPagination, mockSources);

		// Assert
		expect(result).toContain("<html>");
		expect(result).toContain("<title>Ethos - Publications</title>");
		expect(result).toContain("mocked-css");
		expect(result).toContain("<h1>Publications</h1>");
		expect(result).toContain("Test Article 1");
		expect(result).toContain("Test Article 2");
		expect(result).toContain("Test Author 1");
		expect(result).toContain("Test Author 2");
		expect(result).toContain("2022-12-31");
		expect(result).toContain("2023-01-02");
		expect(result).toContain("Source 1");
		expect(result).toContain("Source 2");
	});

	it("should render listing view with source filter", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];

		// Execute
		const result = renderListing(
			publications,
			mockPagination,
			mockSources,
			"source1",
		);

		// Assert
		expect(result).toContain('<select id="source" name="source"');
		expect(result).toContain('<option value="">All Sources</option>');
		expect(result).toContain(
			'<option value="source1" selected="selected">Source 1</option>',
		);
		expect(result).toContain('<option value="source2">Source 2</option>');
	});

	it("should render listing view without publications", () => {
		// Setup
		const publications: PublicationResponse[] = [];
		const emptyPagination: PaginationMeta = {
			total: 0,
			page: 1,
			limit: 10,
			totalPages: 0,
		};

		// Execute
		const result = renderListing(publications, emptyPagination, mockSources);

		// Assert
		expect(result).toContain("<html>");
		expect(result).toContain("<title>Ethos - Publications</title>");
		expect(result).toContain("<p>No publications found.</p>");
	});

	it("should render listing view with pagination", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];
		const multiPagePagination: PaginationMeta = {
			total: 25,
			page: 2,
			limit: 10,
			totalPages: 3,
		};

		// Execute
		const result = renderListing(
			publications,
			multiPagePagination,
			mockSources,
		);

		// Assert
		expect(result).toContain(
			'<nav role="navigation" aria-label="Pagination navigation">',
		);
		expect(result).toContain('<a href="/?page=1" rel="prev">Previous</a>');
		expect(result).toContain("<span>Page 2 of 3</span>");
		expect(result).toContain('<a href="/?page=3" rel="next">Next</a>');
	});

	it("should render listing view with pagination and source filter", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];
		const multiPagePagination: PaginationMeta = {
			total: 25,
			page: 2,
			limit: 10,
			totalPages: 3,
		};

		// Execute
		const result = renderListing(
			publications,
			multiPagePagination,
			mockSources,
			"source1",
		);

		// Assert
		expect(result).toContain(
			'<nav role="navigation" aria-label="Pagination navigation">',
		);
		expect(result).toContain(
			'<a href="/?page=1&amp;source=source1" rel="prev">Previous</a>',
		);
		expect(result).toContain("<span>Page 2 of 3</span>");
		expect(result).toContain(
			'<a href="/?page=3&amp;source=source1" rel="next">Next</a>',
		);
	});

	it("should render listing view without previous link on first page", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];
		const firstPagePagination: PaginationMeta = {
			total: 25,
			page: 1,
			limit: 10,
			totalPages: 3,
		};

		// Execute
		const result = renderListing(
			publications,
			firstPagePagination,
			mockSources,
		);

		// Assert
		expect(result).not.toContain('rel="prev"');
		expect(result).toContain("<span>Page 1 of 3</span>");
		expect(result).toContain('<a href="/?page=2" rel="next">Next</a>');
	});

	it("should render listing view without next link on last page", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];
		const lastPagePagination: PaginationMeta = {
			total: 25,
			page: 3,
			limit: 10,
			totalPages: 3,
		};

		// Execute
		const result = renderListing(publications, lastPagePagination, mockSources);

		// Assert
		expect(result).toContain('<a href="/?page=2" rel="prev">Previous</a>');
		expect(result).toContain("<span>Page 3 of 3</span>");
		expect(result).not.toContain('rel="next"');
	});

	it("should render article URLs with pagination and source params", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];
		const multiPagePagination: PaginationMeta = {
			total: 25,
			page: 2,
			limit: 10,
			totalPages: 3,
		};

		// Execute
		const result = renderListing(
			publications,
			multiPagePagination,
			mockSources,
			"source1",
		);

		// Assert
		expect(result).toContain(
			'<a href="/testhash123?page=2&amp;source=source1">Test Article 1</a>',
		);
		expect(result).toContain(
			'<a href="/testhash123?page=2&amp;source=source1" role="button" aria-label="Read more about #{publication.title}">Continue reading</a>',
		);
	});

	it("should render article URLs without params on first page with no source", () => {
		// Setup
		const publications: PublicationResponse[] = [
			{
				url: "https://example.com/article1",
				title: "Test Article 1",
				content: "<p>Test content 1</p>",
				author: "Test Author 1",
				publishedDate: "2023-01-01T00:00:00.000Z",
				source: "Source 1",
				crawledAt: new Date("2023-01-02T00:00:00.000Z"),
				hash: "testhash123",
			},
		];
		const firstPagePagination: PaginationMeta = {
			total: 25,
			page: 1,
			limit: 10,
			totalPages: 3,
		};

		// Execute
		const result = renderListing(
			publications,
			firstPagePagination,
			mockSources,
		);

		// Assert
		expect(result).toContain('<a href="/testhash123">Test Article 1</a>');
		expect(result).toContain(
			'<a href="/testhash123" role="button" aria-label="Read more about #{publication.title}">Continue reading</a>',
		);
	});
});
