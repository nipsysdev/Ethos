import type { SourceConfig } from "@/core/types";

export const lpeSource: SourceConfig = {
	id: "lpe",
	name: "Logos Press Engine",
	type: "listing",
	listing: {
		url: "https://press.logos.co/search?type=article",
		pagination: {
			next_button_selector: "",
		},
		items: {
			container_selector: ".section .post-card",
			fields: {
				title: {
					selector: ".post-card__title",
					attribute: "text",
				},
				url: {
					selector: ".post-card__title",
					attribute: "href",
				},
				date: {
					selector: ".post-card__label span:nth-of-type(2)",
					attribute: "text",
				},
				excerpt: {
					selector: ".post-card__content > span",
					attribute: "text",
					optional: true,
				},
				author: {
					// Author is not displayed in the listing
					selector: "",
					attribute: "text",
					optional: true,
				},
			},
		},
	},
	content: {
		container_selector: "main article",
		fields: {
			title: {
				selector: "header h1",
				attribute: "text",
				optional: true,
			},
			content: {
				// retrieving all text from the container_selector while excluding specific elements
				selector: "",
				attribute: "text",
				exclude_selectors: ["header", "div", "span"],
			},
			author: {
				selector: "header div > p",
				attribute: "text",
			},
		},
	},
};
