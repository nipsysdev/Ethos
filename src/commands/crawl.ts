import { sources } from "@/config/sources/index.js";
import type { ProcessingPipeline } from "@/core/ProcessingPipeline";
import type { CrawlOptions, CrawlOptionsCLI } from "@/core/types";
import {
	ERROR_MESSAGES,
	FIELD_NAMES,
	INFO_MESSAGES,
	MENU_LABELS,
	NAV_VALUES,
	PROMPT_MESSAGES,
} from "@/ui/constants";
import { displayResults, showPostCrawlMenuWithFlow } from "@/ui/display";
import { displaySources } from "@/ui/formatter";
import { validatePositiveIntegerOrEmpty } from "@/ui/utils";

export async function crawlWithOptions(
	options: CrawlOptionsCLI,
	pipeline: ProcessingPipeline,
): Promise<"main" | "crawl" | "exit"> {
	try {
		const selectedSource = sources.find((s) => s.id === options.source);
		if (!selectedSource) {
			console.log(ERROR_MESSAGES.SOURCE_NOT_FOUND);
			console.log(
				`${ERROR_MESSAGES.AVAILABLE_SOURCES} ${displaySources(sources)}`,
			);
			return NAV_VALUES.MAIN;
		}

		const crawlOptions: CrawlOptions = {};
		if (options.maxPages !== undefined) {
			crawlOptions.maxPages = options.maxPages;
		}
		if (options.stopOnAllDuplicates !== undefined) {
			crawlOptions.stopOnAllDuplicates = options.stopOnAllDuplicates;
		}
		if (options.reCrawlExisting !== undefined) {
			crawlOptions.skipExistingUrls = !options.reCrawlExisting;
		}

		console.log(`${INFO_MESSAGES.CRAWLING} ${selectedSource.name}...`);

		try {
			const result = await pipeline.processSummary(
				selectedSource,
				crawlOptions,
			);
			console.log(INFO_MESSAGES.CRAWL_COMPLETED);

			if (options.output === "json") {
				console.log(JSON.stringify(result, null, 2));
			} else {
				displayResults(result);
			}

			return NAV_VALUES.MAIN;
		} catch (error) {
			console.log(ERROR_MESSAGES.CRAWL_FAILED);
			console.error("Error:", error);
			return NAV_VALUES.MAIN;
		}
	} catch (error) {
		console.error(`${ERROR_MESSAGES.CRAWL_FAILED}:`, error);
		return NAV_VALUES.MAIN;
	}
}

export async function handleCrawl(
	pipeline: ProcessingPipeline,
): Promise<"main" | "crawl" | "exit"> {
	const inquirer = (await import("inquirer")).default;

	try {
		if (sources.length === 0) {
			console.log(ERROR_MESSAGES.NO_SOURCES_CONFIGURED);
			return NAV_VALUES.MAIN;
		}

		const { selectedSourceId } = await inquirer.prompt([
			{
				type: "list",
				name: FIELD_NAMES.SELECTED_SOURCE_ID,
				message: PROMPT_MESSAGES.SELECT_SOURCE_TO_CRAWL,
				choices: [
					...sources.map((source: { name: string; id: string }) => ({
						name: `${source.name} (${source.id})`,
						value: source.id,
					})),
					{
						name: MENU_LABELS.BACK_TO_MAIN,
						value: NAV_VALUES.BACK,
					},
				],
			},
		]);

		if (selectedSourceId === NAV_VALUES.BACK) {
			return NAV_VALUES.MAIN;
		}

		const selectedSource = sources.find((s) => s.id === selectedSourceId);
		if (!selectedSource) {
			console.log(ERROR_MESSAGES.SOURCE_NOT_FOUND);
			console.log(
				`${ERROR_MESSAGES.AVAILABLE_SOURCES} ${displaySources(sources)}`,
			);
			return NAV_VALUES.MAIN;
		}

		const { maxPages, stopOnAllDuplicates, reCrawlExisting } =
			await inquirer.prompt([
				{
					type: "input",
					name: FIELD_NAMES.MAX_PAGES,
					message: PROMPT_MESSAGES.MAX_PAGES_TO_CRAWL,
					default: "",
					validate: validatePositiveIntegerOrEmpty,
				},
				{
					type: "confirm",
					name: FIELD_NAMES.STOP_ON_ALL_DUPLICATES,
					message: PROMPT_MESSAGES.STOP_ON_ALL_DUPLICATES,
					default: true,
				},
				{
					type: "confirm",
					name: FIELD_NAMES.RECRAWL_EXISTING,
					message: PROMPT_MESSAGES.RECRAWL_EXISTING,
					default: false,
				},
			]);

		const options: CrawlOptions = {};
		if (maxPages !== "") {
			options.maxPages = Number.parseInt(maxPages, 10);
		}
		options.stopOnAllDuplicates = stopOnAllDuplicates;
		// If user wants to re-crawl existing content, disable URL skipping
		options.skipExistingUrls = !reCrawlExisting;

		console.log(`${INFO_MESSAGES.CRAWLING} ${selectedSource.name}...`);

		try {
			const result = await pipeline.processSummary(selectedSource, options);
			console.log(INFO_MESSAGES.CRAWL_COMPLETED);
			displayResults(result);

			// Show post-crawl menu and return the action
			return await showPostCrawlMenuWithFlow(result, pipeline);
		} catch (error) {
			console.log(ERROR_MESSAGES.CRAWL_FAILED);
			console.error("Error:", error);
			return NAV_VALUES.MAIN;
		}
	} catch (error) {
		console.error(`${ERROR_MESSAGES.CRAWL_FAILED}:`, error);
		return NAV_VALUES.MAIN;
	}
}
