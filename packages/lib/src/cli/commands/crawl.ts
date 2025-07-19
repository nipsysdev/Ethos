import ora from "ora";
import type { ProcessingPipeline, SourceRegistry } from "../../index.js";
import { displayResults } from "../ui/display.js";

const inquirer = (await import("inquirer")).default;

export async function handleCrawl(
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<void> {
	try {
		// Load available sources
		const sources = await sourceRegistry.getAllSources();

		if (sources.length === 0) {
			console.log(
				"No sources configured. Please add sources to config/sources.yaml",
			);
			return;
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
			return;
		}

		const spinner = ora(`Crawling ${selectedSource.name}...`).start();

		try {
			const result = await pipeline.process(selectedSource);
			spinner.succeed("Crawl completed successfully!");
			displayResults(result);
		} catch (error) {
			spinner.fail("Crawl failed");
			console.error("Error:", error);
		}
	} catch (error) {
		console.error("Crawl failed:", error);
	}
}
