import type { ProcessingPipeline, SourceRegistry } from "../index.js";
import { handleCrawl } from "./commands/crawl.js";

interface Command {
	name: string;
	description: string;
}

const COMMANDS: Command[] = [
	{ name: "crawl", description: "Start crawling a source" },
	{ name: "exit", description: "Exit the program" },
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

		if (command === "exit") {
			console.log("Goodbye!");
			process.exit(0);
		}

		let action = await handleCommand(command, sourceRegistry, pipeline);

		// Handle cascading crawl commands
		while (action === "crawl") {
			action = await handleCrawl(sourceRegistry, pipeline);
		}

		// Handle final action
		if (action === "exit") {
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
		case "crawl":
			return await handleCrawl(sourceRegistry, pipeline);
		default:
			console.log("Unknown command");
			return "main";
	}
}
