import type { ProcessingPipeline, SourceRegistry } from "../index.js";
import { handleCrawl } from "./commands/crawl.js";

const inquirer = (await import("inquirer")).default;

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

		await handleCommand(command, sourceRegistry, pipeline);
	}
}

async function handleCommand(
	command: string,
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<void> {
	switch (command) {
		case "crawl":
			await handleCrawl(sourceRegistry, pipeline);
			break;
		default:
			console.log("Unknown command");
	}
}
