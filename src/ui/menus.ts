import { MENU_LABELS, NAV_VALUES } from "../cli/constants.js";
import { handleClean } from "../commands/clean.js";
import { handleCrawl } from "../commands/crawl.js";
import { handleSessions } from "../commands/sessions.js";
import type {
	ProcessingPipeline,
	ProcessingSummaryResult,
} from "../core/ProcessingPipeline.js";
import type { SourceRegistry } from "../core/SourceRegistry.js";

export function calculateTotalErrors(
	summary: ProcessingSummaryResult["summary"],
): number {
	const { listingErrors, contentErrors, fieldStats, itemsWithErrors } = summary;

	// Use itemsWithErrors if available (more accurate for sessions)
	if (itemsWithErrors !== undefined && itemsWithErrors > 0) {
		return itemsWithErrors;
	}

	// Fallback to calculating from individual error arrays
	const requiredFieldIssues = fieldStats.filter(
		(stat) => !stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	return (
		(listingErrors?.length || 0) +
		(contentErrors?.length || 0) +
		requiredFieldIssues.length
	);
}

export async function createDataViewChoices(
	summary: ProcessingSummaryResult["summary"],
	pipeline?: import("../core/ProcessingPipeline.js").ProcessingPipeline,
	additionalChoices: Array<{ name: string; value: string }> = [],
): Promise<Array<{ name: string; value: string }>> {
	const totalErrors = calculateTotalErrors(summary);

	// Get actual stored items count from junction table if sessionId and pipeline are available
	let availableItems = summary.itemsFound;
	if (summary.sessionId && pipeline) {
		try {
			const metadataStore = pipeline.getMetadataStore();
			if (metadataStore) {
				const contents = metadataStore.getSessionContents(summary.sessionId);
				availableItems = contents.length;
			}
		} catch (error) {
			console.warn("Could not get session contents for accurate count:", error);
			// Fall back to itemsFound if there's an error
		}
	}

	const choices = [
		{ name: `View extracted data (${availableItems})`, value: "view" },
	];

	// Only show error menu if there are errors
	if (totalErrors > 0) {
		choices.push({
			name: `View crawling errors (${totalErrors})`,
			value: "errors",
		});
	}

	choices.push(...additionalChoices);

	return choices;
}

export async function showPostCrawlMenu(
	result: ProcessingSummaryResult,
	pipeline?: import("../core/ProcessingPipeline.js").ProcessingPipeline,
): Promise<"main" | "crawl" | "exit" | "view" | "errors"> {
	const inquirer = (await import("inquirer")).default;

	const choices = await createDataViewChoices(result.summary, pipeline, [
		{ name: "Crawl another source", value: "crawl" },
		{ name: "Return to main menu", value: "main" },
		{ name: "Exit", value: "exit" },
	]);

	const { action } = await inquirer.prompt([
		{
			type: "list",
			name: "action",
			message: "What would you like to do next:",
			choices,
		},
	]);

	return action;
}

interface Command {
	name: string;
	description: string;
}

const COMMANDS: Command[] = [
	{ name: NAV_VALUES.CRAWL, description: "Start crawling a source" },
	{ name: NAV_VALUES.SESSIONS, description: "Browse previous crawl sessions" },
	{ name: "clean", description: "Clean stored data" },
	{ name: NAV_VALUES.EXIT, description: MENU_LABELS.EXIT_PROGRAM },
];

export async function showMainMenu(
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<void> {
	const inquirer = (await import("inquirer")).default;

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

		if (command === NAV_VALUES.EXIT) {
			console.log("Goodbye!");
			process.exit(0);
		}

		let action = await handleCommand(command, sourceRegistry, pipeline);

		while (action === NAV_VALUES.CRAWL) {
			action = await handleCrawl(sourceRegistry, pipeline);
		}

		if (action === NAV_VALUES.EXIT) {
			console.log("Goodbye!");
			process.exit(0);
		}
	}
}

async function handleCommand(
	command: string,
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<"main" | "crawl" | "exit" | undefined> {
	switch (command) {
		case NAV_VALUES.CRAWL:
			return await handleCrawl(sourceRegistry, pipeline);
		case NAV_VALUES.SESSIONS:
			return await handleSessions(pipeline);
		case "clean":
			return await handleClean(sourceRegistry, pipeline);
		default:
			console.log("Unknown command");
			return NAV_VALUES.MAIN;
	}
}
