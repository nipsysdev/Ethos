import type { SourceConfig } from "@/core/types";

export const effSource: SourceConfig = {
	id: "eff",
	name: "Electronic Frontier Foundation",
	type: "listing",
	content_url_excludes: ["/event/"],
	listing: {
		url: "https://eff.org/updates",
		pagination: {
			next_button_selector: ".pager__item.pager__item--next a",
		},
		items: {
			container_selector: ".views-row article.node",
			fields: {
				title: {
					selector: ".node__title",
					attribute: "text",
				},
				url: {
					selector: ".node__title a",
					attribute: "href",
				},
				date: {
					selector: ".node-date",
					attribute: "text",
				},
				excerpt: {
					selector: ".node__content",
					attribute: "text",
					optional: true,
				},
				author: {
					selector: ".node-author",
					attribute: "text",
					optional: true,
				},
				image: {
					selector: ".teaser-thumbnail img",
					attribute: "src",
					optional: true,
				},
			},
		},
	},
	content: {
		container_selector: "#main-content",
		fields: {
			title: {
				selector: ".pane-page-title h1",
				attribute: "text",
			},
			content: {
				selector: ".node--full",
				exclude_selectors: [".take-action", ".field--type-file"],
				attribute: "text",
			},
		},
	},
};
