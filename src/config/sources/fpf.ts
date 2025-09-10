import type { SourceConfig } from "@/core/types";

export const fpfSource: SourceConfig = {
	id: "fpf",
	name: "Freedom of the Press Foundation",
	type: "listing",
	listing: {
		url: "https://freedom.press/issues/",
		pagination: {
			next_button_selector: ".pagination .pagination-link:nth-of-type(2)",
		},
		items: {
			container_selector: ".article-list .card-listing",
			fields: {
				title: {
					selector: ".heading .card-link",
					attribute: "text",
				},
				url: {
					selector: ".heading .card-link",
					attribute: "href",
				},
				date: {
					selector: ".meta-info time",
					attribute: "datetime",
				},
				excerpt: {
					selector: ".inner-content p",
					attribute: "text",
					optional: true,
				},
				author: {
					selector: ".meta-info .card-meta-link:not(:nth-child(1))",
					attribute: "text",
					optional: true,
				},
			},
		},
	},
	content: {
		container_selector: ".blog-page",
		fields: {
			title: {
				selector: "h1.heading",
				attribute: "text",
				optional: true,
			},
			content: {
				selector: ".post-content",
				attribute: "text",
				exclude_selectors: [".form.newsletter-signup"],
			},
		},
	},
};
