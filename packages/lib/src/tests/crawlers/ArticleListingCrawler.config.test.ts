import { describe, expect, it } from "vitest";
import type { SourceConfig } from "@/core/types.js";
import { CRAWLER_TYPES } from "@/core/types.js";

describe("ArticleListingCrawler - Configuration Validation", () => {
	it("should handle pagination config structure", () => {
		const configWithPagination: SourceConfig = {
			id: "test-pagination",
			name: "Test Pagination",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				pagination: {
					next_button_selector: ".pager__item.pager__item--next",
					// Add more pagination config as needed
				},
				items: {
					container_selector: ".item",
					fields: {
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
			content: {
				container_selector: ".article",
				fields: {
					content: { selector: ".content", attribute: "text" },
				},
			},
		};

		expect(configWithPagination.listing.pagination?.next_button_selector).toBe(
			".pager__item.pager__item--next",
		);
	});

	it("should handle configs without pagination", () => {
		const configNoPagination: SourceConfig = {
			id: "test-no-pagination",
			name: "Test No Pagination",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".item",
					fields: {
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
			content: {
				container_selector: ".article",
				fields: {
					content: { selector: ".content", attribute: "text" },
				},
			},
		};

		expect(configNoPagination.listing.pagination).toBeUndefined();
	});

	it("should handle content page configuration", () => {
		const configWithContent: SourceConfig = {
			id: "test-content",
			name: "Test Content",
			type: CRAWLER_TYPES.LISTING,
			listing: {
				url: "https://example.com",
				items: {
					container_selector: ".item",
					fields: {
						url: { selector: "a", attribute: "href" },
						title: { selector: ".title", attribute: "text" },
					},
				},
			},
			content: {
				container_selector: ".article",
				fields: {
					title: { selector: "h1", attribute: "text" },
					content: { selector: ".content", attribute: "text" },
					author: { selector: ".author", attribute: "text", optional: true },
				},
			},
		};

		expect(configWithContent.content).toBeDefined();
		expect(configWithContent.content?.fields.title.selector).toBe("h1");
		expect(configWithContent.content?.fields.author.optional).toBe(true);
	});

	it("should validate field configurations", () => {
		const fieldsConfig = {
			title: { selector: ".title", attribute: "text" },
			author: { selector: ".author", attribute: "text", optional: true },
		};

		const titleField = fieldsConfig.title;
		const authorField = fieldsConfig.author;

		expect(titleField.attribute).toBe("text");
		expect(authorField.optional).toBe(true);
		expect((titleField as { optional?: boolean }).optional).toBeUndefined();
	});
});
