import type { ProcessingResult } from "@/index.js";
import { showPostCrawlMenu } from "./menus.js";
import { displayCrawlSummary } from "./summary.js";
import { showExtractedData } from "./viewer.js";

export function displayResults(result: ProcessingResult): void {
	displayCrawlSummary(result);
}

export async function showPostCrawlMenuWithFlow(
	result: ProcessingResult,
): Promise<"main" | "crawl" | "exit"> {
	const action = await showPostCrawlMenu();

	if (action === "view") {
		await showExtractedData(result);
		// After viewing data, show menu again
		return await showPostCrawlMenuWithFlow(result);
	}

	return action;
}
