import type { SourceConfig } from "@/core/types";

export const tfSource: SourceConfig = {
	id: "tf",
	name: "TorrentFreak",
	type: "listing",
	listing: {
		url: "https://torrentfreak.com/",
		pagination: {
			next_button_selector: ".page__navigation .navigation__link.next",
		},
		items: {
			container_selector: ".page__content .preview-article",
			fields: {
				title: {
					selector: ".preview-article__title",
					attribute: "text",
				},
				url: {
					selector: "& > a",
					attribute: "href",
				},
				date: {
					selector: ".preview-article__published time",
					attribute: "text",
				},
			},
		},
	},
	content: {
		container_selector: "main",
		fields: {
			title: {
				selector: ".hero__title",
				attribute: "text",
				optional: true,
			},
			content: {
				selector: ".article .article__body",
				attribute: "node",
			},
			author: {
				selector: ".hero__published",
				exclude_selectors: ["time"],
				attribute: "text",
				optional: true,
			},
		},
	},
};
