import { CrawlerType, type SourceConfig } from "@/core/types";

export const P2pFoundationSource: SourceConfig = {
	id: "p2p_foundation",
	name: "P2P Foundation",
	type: CrawlerType.Listing,
	disableJavascript: true,
	listing: {
		url: "https://blog.p2pfoundation.net/",
		pagination: {
			next_button_selector: ".nav-previous a",
		},
		container_selector: ".blog-masonry article",
		fields: {
			title: {
				selector: ".entry-title",
				attribute: "text",
			},
			url: {
				selector: ".entry-title a",
				attribute: "href",
			},
			date: {
				selector: ".entry-date",
				attribute: "text",
			},
		},
	},
	content: {
		container_selector: "#main",
		fields: {
			title: {
				selector: ".entry-header .entry-title",
				attribute: "text",
				optional: true,
			},
			content: {
				selector: "article.post .entry-content",
				attribute: "node",
			},
			author: {
				selector: ".entry-header .author",
				attribute: "text",
				exclude_selectors: [".pw-icon-user-outline"],
			},
		},
	},
};
