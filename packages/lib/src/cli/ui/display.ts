import type { ProcessingSummaryResult } from "@/index.js";
import { showPostCrawlMenu } from "./menus.js";
import { displayCrawlSummary } from "./summary.js";
import { showExtractedData } from "./viewer.js";

export function displayResults(result: ProcessingSummaryResult): void {
	displayCrawlSummary(result);
}

export async function showPostCrawlMenuWithFlow(
	result: ProcessingSummaryResult,
): Promise<"main" | "crawl" | "exit"> {
	// Keep looping until user chooses to leave this crawl result context
	while (true) {
		const action = await showPostCrawlMenu(result);

		if (action === "view") {
			await showExtractedData(result);
			// Continue the loop - stay in this crawl result context
			continue;
		}

		if (action === "errors") {
			const { showCrawlErrors } = await import("../commands/errors.js");
			await showCrawlErrors(result);
			// Continue the loop - stay in this crawl result context
			continue;
		}

		// Any non-"view" or non-"errors" action means we're leaving this crawl result context
		return action;
	}
}
