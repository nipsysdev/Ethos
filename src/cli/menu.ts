import type { ProcessingPipeline, SourceRegistry } from "@/index.js";
import { handleClean } from "./commands/clean.js";
import { handleCrawl } from "./commands/crawl.js";
import { handleSessions } from "./commands/sessions.js";
import { MENU_LABELS, NAV_VALUES } from "./constants.js";

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

		// Handle cascading crawl commands
		while (action === NAV_VALUES.CRAWL) {
			action = await handleCrawl(sourceRegistry, pipeline);
		}

		// Handle final action
		if (action === NAV_VALUES.EXIT) {
			console.log("Goodbye!");
			process.exit(0);
		}
		// For "main" or undefined, continue to show main menu
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
