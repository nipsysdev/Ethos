import type { SourceConfig } from "@/core/types";

export const dukSource: SourceConfig = {
	id: "duk",
	name: "Declassified UK",
	type: "listing",
	disableJavascript: true,
	listing: {
		url: "https://www.declassifieduk.org/category/archive/",
		pagination: {
			next_button_selector: ".wp-pagenavi .nextpostslink",
		},
		container_selector: ".blog-with-tags.ls-archive-blog .et_pb_post",
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
				selector: ".post-meta .published",
				attribute: "text",
			},
		},
	},
	content: {
		container_selector: "#main-content",
		fields: {
			title: {
				selector: ".entry-title",
				attribute: "text",
				optional: true,
			},
			content: {
				selector: ".et_pb_post_content",
				exclude_selectors: [
					".wp-block-buttons",
					".wp-block-separator",
					".related-post",
				],
				attribute: "node",
			},
			author: {
				selector: ".ls_co_authors",
				exclude_selectors: [".ls-date"],
				attribute: "text",
				optional: true,
			},
		},
	},
};
