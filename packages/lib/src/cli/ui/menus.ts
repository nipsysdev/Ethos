import type { ProcessingSummaryResult } from "@/index.js";

export async function showPostCrawlMenu(
	result: ProcessingSummaryResult,
): Promise<"main" | "crawl" | "exit" | "view" | "errors"> {
	const inquirer = (await import("inquirer")).default;

	// Calculate total error count
	const { summary } = result;
	const { listingErrors, contentErrors, fieldStats } = summary;

	const requiredFieldIssues = fieldStats.filter(
		(stat) => !stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	const totalErrors =
		(listingErrors?.length || 0) +
		(contentErrors?.length || 0) +
		requiredFieldIssues.length;

	const choices = [{ name: "View extracted data", value: "view" }];

	// Only show error menu if there are errors
	if (totalErrors > 0) {
		choices.push({
			name: `View crawling errors (${totalErrors})`,
			value: "errors",
		});
	}

	choices.push(
		{ name: "Crawl another source", value: "crawl" },
		{ name: "Return to main menu", value: "main" },
		{ name: "Exit", value: "exit" },
	);

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
