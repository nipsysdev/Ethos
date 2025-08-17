import { showCrawlErrors } from "@/commands/errors";
import type {
	ProcessingPipeline,
	ProcessingSummaryResult,
} from "@/core/ProcessingPipeline";
import { createMetadataStore } from "@/storage/MetadataStore";
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
	const metadataStoreFactory = () => createMetadataStore();

	while (true) {
		const action = await showPostCrawlMenu(result, pipeline);

		if (action === "view") {
			await showExtractedData(result, metadataStoreFactory());
			displayCrawlSummary(result);
			continue;
		}

		if (action === "errors") {
			await showCrawlErrors(result);
			displayCrawlSummary(result);
			continue;
		}

		return action;
	}
}
