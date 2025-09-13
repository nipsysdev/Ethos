import type { SourceConfig } from "@/core/types";

export const p2pSource: SourceConfig = {
	id: "p2p",
	name: "P2P Foundation",
	type: "listing",
	listing: {
		url: "https://blog.p2pfoundation.net/",
		pagination: {
			next_button_selector: ".nav-previous a",
		},
		items: {
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
				excerpt: {
					selector: ".entry-content",
					attribute: "text",
					optional: true,
				},
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
