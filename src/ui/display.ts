import type {
	ProcessingPipeline,
	ProcessingSummaryResult,
} from "@/core/ProcessingPipeline";
import { showPostCrawlMenu } from "@/ui/menus";
import { displayCrawlSummary } from "@/ui/summary";
import { showExtractedData } from "@/ui/viewer";

export function displayResults(result: ProcessingSummaryResult): void {
	displayCrawlSummary(result);
}

export async function showPostCrawlMenuWithFlow(
	result: ProcessingSummaryResult,
	pipeline?: ProcessingPipeline,
): Promise<"main" | "crawl" | "exit"> {
	// Keep looping until user chooses to leave this crawl result context
	while (true) {
		const action = await showPostCrawlMenu(result, pipeline);

		if (action === "view") {
			await showExtractedData(result);
			// After viewing, show the summary again and continue the loop
			displayCrawlSummary(result);
			continue;
		}

		if (action === "errors") {
			const { showCrawlErrors } = await import("../commands/errors.js");
			await showCrawlErrors(result);
			// After viewing errors, show the summary again and continue the loop
			displayCrawlSummary(result);
			continue;
		}

		// Any non-"view" or non-"errors" action means we're leaving this crawl result context
		return action;
	}
}
