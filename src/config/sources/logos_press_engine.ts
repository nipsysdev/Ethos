import { CrawlerType, type SourceConfig } from "@/core/types";

export const LogosPressEngineSource: SourceConfig = {
	id: "logos_press_engine",
	name: "Logos Press Engine",
	type: CrawlerType.Listing,
	listing: {
		url: "https://press.logos.co/search?type=article",
		pagination: {
			next_button_selector: "",
		},
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
				attribute: "node",
				exclude_selectors: ["header", "div", "span"],
			},
			author: {
				selector: "header div > p",
				attribute: "text",
			},
		},
	},
};
