import type { ProcessingSummaryResult } from "@/index.js";

/**
 * Calculate total error count from a processing summary
 */
export function calculateTotalErrors(
	summary: ProcessingSummaryResult["summary"],
): number {
	const { listingErrors, contentErrors, fieldStats } = summary;

	const requiredFieldIssues = fieldStats.filter(
		(stat) => !stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	return (
		(listingErrors?.length || 0) +
		(contentErrors?.length || 0) +
		requiredFieldIssues.length
	);
}

/**
 * Create menu choices for viewing data and errors
 */
export async function createDataViewChoices(
	summary: ProcessingSummaryResult["summary"],
	pipeline?: import("@/index.js").ProcessingPipeline,
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

	// Add any additional choices
	choices.push(...additionalChoices);

	return choices;
}

export async function showPostCrawlMenu(
	result: ProcessingSummaryResult,
	pipeline?: import("@/index.js").ProcessingPipeline,
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
