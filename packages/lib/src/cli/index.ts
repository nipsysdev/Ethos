import { join } from "node:path";
import { Command } from "commander";
import {
	ArticleListingCrawler,
	CrawlerRegistry,
	type ProcessedData,
	ProcessingPipeline,
	SourceRegistry,
} from "../index.js";

const inquirer = (await import("inquirer")).default;

const program = new Command();

// Initialize the system
const sourceRegistry = new SourceRegistry(
	join(process.cwd(), "src", "config", "sources.yaml"),
);
const crawlerRegistry = new CrawlerRegistry();
const pipeline = new ProcessingPipeline(crawlerRegistry);

// Register crawlers
crawlerRegistry.register(new ArticleListingCrawler());

const COMMANDS = [
	{ name: "crawl", description: "Start crawling a source" },
	{ name: "exit", description: "Exit the program" },
];

async function showMainMenu() {
	while (true) {
		const { command } = await inquirer.prompt([
			{
				type: "list",
				name: "command",
				message: "Select a command:",
				choices: COMMANDS.map((cmd) => ({
					name: `${cmd.name} - ${cmd.description}`,
					value: cmd.name,
				})),
			},
		]);

		if (command === "exit") {
			console.log("Goodbye!");
			process.exit(0);
		}

		await handleCommand(command);
	}
}

async function handleCommand(command: string) {
	switch (command) {
		case "crawl":
			await handleCrawl();
			break;
		default:
			console.log("Unknown command");
	}
}

function displayResults(results: ProcessedData[]) {
	console.log("Crawl completed successfully!");
	console.log(`Processed ${results.length} items`);

	// Show detailed information for each item
	if (results.length > 0) {
		console.log(`\n${"=".repeat(80)}`);
		console.log("EXTRACTED ITEMS:");
		console.log(`${"=".repeat(80)}`);

		results.forEach((item, index) => {
			console.log(`\n--- Item ${index + 1} of ${results.length} ---`);
			console.log(`Title: ${item.title}`);
			console.log(`URL: ${item.url}`);
			console.log(`Source: ${item.source}`);

			// Show article publication date if available, otherwise crawl timestamp
			if (item.publishedDate) {
				try {
					const parsedDate = new Date(item.publishedDate);
					if (!Number.isNaN(parsedDate.getTime())) {
						console.log(
							`Published: ${parsedDate.toLocaleDateString()} ${parsedDate.toLocaleTimeString()}`,
						);
					} else {
						console.log(`Published: ${item.publishedDate}`); // Raw date string if parsing fails
					}
				} catch {
					console.log(`Published: ${item.publishedDate}`); // Raw date string if parsing fails
				}
			} else {
				console.log(
					`Crawled: ${item.timestamp.toLocaleDateString()} ${item.timestamp.toLocaleTimeString()}`,
				);
			}

			if (item.excerpt) {
				console.log(`Excerpt: ${item.excerpt}`);
			}

			if (item.author) {
				console.log(`Author: ${item.author}`);
			}

			// Show image URL if available
			if (item.image) {
				console.log(`Image: ${item.image}`);
			}

			console.log(`Content: ${item.content}`);

			if (item.tags && item.tags.length > 0) {
				console.log(`Tags: ${item.tags.join(", ")}`);
			}

			// Show metadata
			console.log(`\nMetadata:`);
			Object.entries(item.metadata).forEach(([key, value]) => {
				console.log(`  ${key}: ${JSON.stringify(value)}`);
			});

			if (index < results.length - 1) {
				console.log(`\n${"-".repeat(40)}`);
			}
		});

		console.log(`\n${"=".repeat(80)}`);
	}
}

async function handleCrawl() {
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

		console.log(`Starting crawl of ${selectedSource.name}...`);
		const results = await pipeline.process(selectedSource);

		displayResults(results);
	} catch (error) {
		console.error("Crawl failed:", error);
	}
}

program
	.name("ethos-crawler")
	.description("CLI for Ethos crawling library")
	.version("1.0.0")
	.action(async () => {
		await showMainMenu();
	});

program.parseAsync(process.argv).catch(console.error);
