import ora from "ora";
import type {
	CrawlOptions,
	ProcessingPipeline,
	SourceRegistry,
} from "../../index.js";
import { displayResults, showPostCrawlMenuWithFlow } from "../ui/display.js";

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
		const { maxPages } = await inquirer.prompt([
			{
				type: "input",
				name: "maxPages",
				message: "Max pages to crawl (leave empty for no limit):",
				default: "",
				validate: (input: string) => {
					if (input === "") return true;
					const num = Number.parseInt(input, 10);
					return (
						(!Number.isNaN(num) && num > 0) ||
						"Please enter a positive number or leave empty"
					);
				},
			},
		]);

		const options: CrawlOptions = {};
		if (maxPages !== "") {
			options.maxPages = Number.parseInt(maxPages, 10);
		}

		const spinner = ora(`Crawling ${selectedSource.name}...`).start();

		try {
			const result = await pipeline.process(selectedSource, options);
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
