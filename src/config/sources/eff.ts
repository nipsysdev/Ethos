import type { SourceConfig } from "@/core/types";

export const effSource: SourceConfig = {
	id: "eff",
	name: "Electronic Frontier Foundation",
	type: "listing",
	listing: {
		url: "https://eff.org/updates",
		pagination: {
			next_button_selector: ".pager__item.pager__item--next a",
		},
		container_selector: ".views-row article.node",
		shouldExcludeItem: (_, values) => {
			const excludedPaths = [
				"eff.org/event/",
				"eff.org/wp/",
				"eff.org/cases/",
				"eff.org/calendar/",
			];
			return !!excludedPaths.filter((path) => values?.url?.includes(path))
				.length;
		},
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
			author: {
				selector: ".node-author",
				attribute: "text",
				optional: true,
			},
		},
	},
	content: {
		container_selector: "#main-content",
		fields: {
			title: {
				selector: ".pane-page-title h1",
				attribute: "text",
				optional: true,
			},
			content: {
				selector: ".node--full",
				exclude_selectors: [".take-action", ".field--type-file"],
				attribute: "node",
			},
		},
	},
};
