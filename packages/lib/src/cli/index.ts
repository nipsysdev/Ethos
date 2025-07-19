import { join } from "node:path";
import { Command } from "commander";
import ora from "ora";
import {
	ArticleListingCrawler,
	CrawlerRegistry,
	type FieldExtractionStats,
	ProcessingPipeline,
	type ProcessingResult,
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

function displayResults(result: ProcessingResult) {
	const { summary } = result;
	const duration =
		(summary.endTime.getTime() - summary.startTime.getTime()) / 1000;

	// Summary stats
	console.log("📊 Summary:");
	console.log(`   • Source: ${summary.sourceName} (${summary.sourceId})`);
	console.log(`   • Items found: ${summary.itemsFound}`);
	console.log(`   • Items successfully processed: ${summary.itemsProcessed}`);

	if (summary.itemsWithErrors > 0) {
		console.log(`   • Items with errors: ${summary.itemsWithErrors}`);
	}

	// Field extraction stats
	console.log("\n📋 Field extraction stats:");
	summary.fieldStats.forEach((stat: FieldExtractionStats) => {
		const percentage =
			stat.totalAttempts > 0
				? Math.round((stat.successCount / stat.totalAttempts) * 100)
				: 0;
		const optionalLabel = stat.isOptional ? " (optional)" : "";

		console.log(
			`   • ${stat.fieldName}: ${stat.successCount}/${stat.totalAttempts} (${percentage}%)${optionalLabel}`,
		);
	});

	// Only show issues for required fields or actual errors
	const requiredFieldIssues = summary.fieldStats.filter(
		(stat: FieldExtractionStats) =>
			!stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	if (requiredFieldIssues.length > 0 || summary.errors.length > 0) {
		console.log("\n⚠️  Issues found:");

		requiredFieldIssues.forEach((stat: FieldExtractionStats) => {
			const missingCount = stat.totalAttempts - stat.successCount;
			console.log(
				`   • ${missingCount} item(s) missing required field: ${stat.fieldName}`,
			);
		});

		summary.errors.forEach((error: string) => {
			console.log(`   • ${error}`);
		});
	}

	// Timing
	console.log(`\n⏱️  Crawl took: ${duration} seconds`);
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

program
	.name("ethos-crawler")
	.description("CLI for Ethos crawling library")
	.version("1.0.0")
	.action(async () => {
		await showMainMenu();
	});

program.parseAsync(process.argv).catch(console.error);
