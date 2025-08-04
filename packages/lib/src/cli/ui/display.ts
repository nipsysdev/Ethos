import { unlinkSync } from "node:fs";
import type { ProcessingResult } from "@/index.js";
import { showPostCrawlMenu } from "./menus.js";
import { displayCrawlSummary } from "./summary.js";
import { showExtractedData } from "./viewer.js";

/**
 * Clean up temporary metadata file if it exists
 */
async function cleanupTempMetadataFile(
	result: ProcessingResult,
): Promise<void> {
	if (result.summary.tempMetadataFile) {
		try {
			unlinkSync(result.summary.tempMetadataFile);
			console.log("🗑️  Cleaned up temporary metadata file");

			// Unregister from global tracking
			try {
				const { unregisterTempFile } = await import("@/cli/index.js");
				unregisterTempFile(result.summary.tempMetadataFile);
			} catch {
				// Not in CLI context, ignore
			}
		} catch {
			// Ignore cleanup errors - file might already be deleted
		}
	}
}

export function displayResults(result: ProcessingResult): void {
	displayCrawlSummary(result);
}

export async function showPostCrawlMenuWithFlow(
	result: ProcessingResult,
): Promise<"main" | "crawl" | "exit"> {
	try {
		// Keep looping until user chooses to leave this crawl result context
		while (true) {
			const action = await showPostCrawlMenu();

			if (action === "view") {
				await showExtractedData(result);
				// Continue the loop - stay in this crawl result context
				continue;
			}

			// Any non-"view" action means we're leaving this crawl result context
			// Clean up the temp file before returning
			await cleanupTempMetadataFile(result);
			return action;
		}
	} catch (error) {
		// If there's any error, make sure we clean up before re-throwing
		await cleanupTempMetadataFile(result);
		throw error;
	}
}
