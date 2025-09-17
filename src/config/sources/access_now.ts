import { CrawlerType, type SourceConfig } from "@/core/types";

export const AccessNowSource: SourceConfig = {
	id: "access_now",
	name: "Access Now",
	type: CrawlerType.Listing,
	listing: {
		url: "https://www.accessnow.org/news-updates/?_language=english",
		pagination: {
			next_button_selector: ".post-grid-pagination .facetwp-page.next",
			delaySec: 30, // Access Now blocks IP address when it detects aggressive crawling
		},
		container_selector: ".post-grid.facetwp-template .post-grid-item",
		shouldExcludeItem: (containerHtml, values) => {
			const excludedPaths = [
				"accessnow.org/press-release",
				"accessnow.org/guide",
			];
			return (
				containerHtml.includes("post-grid-item--external-icon") ||
				!!excludedPaths.filter((path) => values?.url?.includes(path)).length
			);
		},
		fields: {
			title: {
				selector: ".post-grid-item--title",
				attribute: "text",
			},
			url: {
				selector: ".post-grid-item--link",
				attribute: "href",
			},
			publishedDate: {
				selector: ".post-grid-item--date",
				attribute: "text",
			},
		},
	},
	content: {
		container_selector: "#post-container",
		fields: {
			title: {
				selector: "header h1",
				attribute: "text",
				optional: true,
			},
			content: {
				selector: ".entry-content",
				attribute: "node",
			},
			author: {
				selector: "#authors",
				exclude_selectors: [".profilePic", ".authorInfo > a"],
				attribute: "text",
				optional: true,
			},
		},
	},
};
