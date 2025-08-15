import type { ProcessingSummaryResult } from "@/core/ProcessingPipeline";
import type { FieldExtractionStats } from "@/core/types";

export function displayCrawlSummary(result: ProcessingSummaryResult): void {
	const { summary } = result;
	const duration =
		(summary.endTime.getTime() - summary.startTime.getTime()) / 1000;

	console.log("Summary:");
	console.log(`  Source: ${summary.sourceName} (${summary.sourceId})`);
	console.log(`  Items found: ${summary.itemsFound}`);
	console.log(`  Items successfully retrieved: ${summary.itemsProcessed}`);

	if (summary.itemsWithErrors > 0) {
		console.log(`  Items with errors: ${summary.itemsWithErrors}`);

		const listingErrorCount = summary.listingErrors?.length || 0;
		const contentErrorCount = summary.contentErrors?.length || 0;

		if (listingErrorCount > 0) {
			console.log(`    Listing extraction errors: ${listingErrorCount}`);
		}
		if (contentErrorCount > 0) {
			console.log(`    Content extraction errors: ${contentErrorCount}`);
		}
	}

	if (summary.pagesProcessed !== undefined) {
		console.log(`  Listing pages processed: ${summary.pagesProcessed}`);

		if (
			summary.duplicatesSkipped !== undefined &&
			summary.duplicatesSkipped > 0
		) {
			console.log(`  Duplicates skipped: ${summary.duplicatesSkipped}`);
		}

		if (summary.urlsExcluded !== undefined && summary.urlsExcluded > 0) {
			console.log(`  URLs excluded: ${summary.urlsExcluded}`);
		}

		if (summary.stoppedReason) {
			const reasonMessages = {
				max_pages: "reached maximum pages limit",
				no_next_button: "no more pages available",
				all_duplicates: "all items on page were already crawled",
				process_interrupted: "process was interrupted",
			};
			console.log(`  Stop reason: ${reasonMessages[summary.stoppedReason]}`);
		}
	}

	console.log("\nListing field extraction stats:");
	summary.fieldStats.forEach((stat: FieldExtractionStats) => {
		const percentage =
			stat.totalAttempts > 0
				? Math.round((stat.successCount / stat.totalAttempts) * 100)
				: 0;
		const optionalLabel = stat.isOptional ? " (optional)" : "";

		console.log(
			`  ${stat.fieldName}: ${stat.successCount}/${stat.totalAttempts} (${percentage}%)${optionalLabel}`,
		);
	});

	const contentStats = summary.contentFieldStats;
	if (contentStats && contentStats.length > 0) {
		console.log("\nContent field extraction stats:");
		contentStats.forEach((stat: FieldExtractionStats) => {
			const percentage =
				stat.totalAttempts > 0
					? Math.round((stat.successCount / stat.totalAttempts) * 100)
					: 0;

			console.log(
				`  ${stat.fieldName}: ${stat.successCount}/${stat.totalAttempts} (${percentage}%)`,
			);
		});
	}

	console.log(`\nCrawl took: ${duration} seconds`);
}
