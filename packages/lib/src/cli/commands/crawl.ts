import ora from "ora";
import type { ProcessingPipeline, SourceRegistry } from "../../index.js";
import { displayResults, showPostCrawlMenuWithFlow } from "../ui/display.js";

const inquirer = (await import("inquirer")).default;

export async function handleCrawl(
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<"main" | "crawl" | "exit"> {
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

		const spinner = ora(`Crawling ${selectedSource.name}...`).start();

		try {
			const result = await pipeline.process(selectedSource);
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
