import { join } from "node:path";
import { Command } from "commander";
import {
	ArticleListingCrawler,
	CrawlerRegistry,
	KeywordExtractor,
	ProcessingPipeline,
	SourceRegistry,
	StrategyRegistry,
} from "../index.js";

const inquirer = (await import("inquirer")).default;

const program = new Command();

// Initialize the system
const sourceRegistry = new SourceRegistry(
	join(process.cwd(), "src", "config", "sources.yaml"),
);
const crawlerRegistry = new CrawlerRegistry();
const strategyRegistry = new StrategyRegistry();
const pipeline = new ProcessingPipeline(crawlerRegistry, strategyRegistry);

// Register crawlers and strategies
crawlerRegistry.register(new ArticleListingCrawler());
strategyRegistry.register(new KeywordExtractor());

const COMMANDS = [
	{ name: "crawl", description: "Start crawling a source" },
	{ name: "analyze", description: "Analyze crawled data" },
	{ name: "run", description: "Run continuous crawling" },
	{ name: "config", description: "Manage configuration" },
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
		case "analyze":
		case "run":
		case "config":
			console.log(`${command} command is not yet implemented`);
			break;
		default:
			console.log("Unknown command");
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

		console.log("Crawl completed successfully!");
		console.log(`Processed ${results.length} items`);

		// Show a summary of the first result
		if (results.length > 0) {
			const first = results[0];
			console.log(`\nFirst item:`);
			console.log(`Title: ${first.title}`);
			console.log(`Content length: ${first.content.length} characters`);
			console.log(
				`Keywords found: ${first.analysis[0]?.keywords.join(", ") || "none"}`,
			);
			console.log(`Relevance score: ${first.analysis[0]?.relevance || 0}`);
		}
	} catch (error) {
		console.error("Crawl failed:", error);
	}
}

program
	.name("ethos-crawler")
	.description("CLI for Ethos crawling library")
	.version("1.0.0")
	.command("crawl")
	.description("Start crawling a source")
	.action(async () => {
		await handleCrawl();
	});

program.action(async () => {
	await showMainMenu();
});

program.parseAsync(process.argv).catch(console.error);
