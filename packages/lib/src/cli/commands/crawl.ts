import ora from "ora";
import type {
	CrawlOptions,
	ProcessingPipeline,
	SourceRegistry,
} from "@/index.js";
import { displayResults, showPostCrawlMenuWithFlow } from "../ui/display.js";

/**
 * Validates input for positive integer fields that can be left empty
 * @param input - The input string to validate
 * @returns true if valid, error message string if invalid
 */
export function validatePositiveIntegerOrEmpty(input: string): true | string {
	if (input === "") return true;
	const num = Number.parseInt(input, 10);
	if (Number.isNaN(num) || num <= 0) {
		return "Please enter a positive number greater than 0 or leave empty";
	}
	return true;
}

export async function handleCrawl(
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<"main" | "crawl" | "exit"> {
	const inquirer = (await import("inquirer")).default;

	try {
		// Load available sources
		const sources = await sourceRegistry.getAllSources();

		if (sources.length === 0) {
			console.log(
				"No sources configured. Please add sources to config/sources.yaml",
			);
			return "main";
		}

		const { selectedSourceId } = await inquirer.prompt([
			{
				type: "list",
				name: "selectedSourceId",
				message: "Select a source to crawl:",
				choices: sources.map((source) => ({
					name: `${source.name} (${source.id})`,
					value: source.id,
				})),
			},
		]);

		const selectedSource = await sourceRegistry.getSource(selectedSourceId);
		if (!selectedSource) {
			console.log("Source not found");
			return "main";
		}

		// Ask for crawl options
		const { maxPages, stopOnAllDuplicates } = await inquirer.prompt([
			{
				type: "input",
				name: "maxPages",
				message: "Max pages to crawl (leave empty for no limit):",
				default: "",
				validate: validatePositiveIntegerOrEmpty,
			},
			{
				type: "confirm",
				name: "stopOnAllDuplicates",
				message:
					"Stop crawling when all items on a page are already in database?",
				default: true,
			},
		]);

		const options: CrawlOptions = {};
		if (maxPages !== "") {
			options.maxPages = Number.parseInt(maxPages, 10);
		}
		options.stopOnAllDuplicates = stopOnAllDuplicates;

		const spinner = ora(`Crawling ${selectedSource.name}...`).start();

		try {
			const result = await pipeline.processSummary(selectedSource, options);
			spinner.succeed("Crawl completed successfully!");
			displayResults(result);

			// Show post-crawl menu and return the action
			return await showPostCrawlMenuWithFlow(result);
		} catch (error) {
			spinner.fail("Crawl failed");
			console.error("Error:", error);
			return "main";
		}
	} catch (error) {
		console.error("Crawl failed:", error);
		return "main";
	}
}
