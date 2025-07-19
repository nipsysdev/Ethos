export async function showPostCrawlMenu(): Promise<
	"main" | "crawl" | "exit" | "view"
> {
	const inquirer = (await import("inquirer")).default;

	const choices = [
		{ name: "View extracted data", value: "view" },
		{ name: "Crawl another source", value: "crawl" },
		{ name: "Return to main menu", value: "main" },
		{ name: "Exit", value: "exit" },
	];

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
