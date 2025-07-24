import type { FieldExtractionStats, ProcessingResult } from "../../index.js";

export function displayCrawlSummary(result: ProcessingResult): void {
	const { summary } = result;
	const duration =
		(summary.endTime.getTime() - summary.startTime.getTime()) / 1000;

	// Summary stats
	console.log("📊 Summary:");
	console.log(`   • Source: ${summary.sourceName} (${summary.sourceId})`);
	console.log(`   • Items found: ${summary.itemsFound}`);
	console.log(`   • Items successfully processed: ${summary.itemsProcessed}`);

	if (summary.itemsWithErrors > 0) {
		console.log(`   • Items with errors: ${summary.itemsWithErrors}`);
	}

	// Pagination stats (if available)
	if (summary.pagesProcessed !== undefined) {
		console.log(`   • Pages processed: ${summary.pagesProcessed}`);

		if (
			summary.duplicatesSkipped !== undefined &&
			summary.duplicatesSkipped > 0
		) {
			console.log(`   • Duplicates skipped: ${summary.duplicatesSkipped}`);
		}

		if (summary.stoppedReason) {
			const reasonMessages = {
				max_pages: "reached maximum pages limit",
				no_next_button: "no more pages available",
				all_duplicates: "all items on page were already crawled",
			};
			console.log(`   • Stop reason: ${reasonMessages[summary.stoppedReason]}`);
		}
	}

	// Field extraction stats
	console.log("\n📋 Field extraction stats:");
	summary.fieldStats.forEach((stat: FieldExtractionStats) => {
		const percentage =
			stat.totalAttempts > 0
				? Math.round((stat.successCount / stat.totalAttempts) * 100)
				: 0;
		const optionalLabel = stat.isOptional ? " (optional)" : "";

		console.log(
			`   • ${stat.fieldName}: ${stat.successCount}/${stat.totalAttempts} (${percentage}%)${optionalLabel}`,
		);
	});

	// Only show issues for required fields or actual errors
	const requiredFieldIssues = summary.fieldStats.filter(
		(stat: FieldExtractionStats) =>
			!stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	if (requiredFieldIssues.length > 0 || summary.errors.length > 0) {
		console.log("\n⚠️  Issues found:");

		requiredFieldIssues.forEach((stat: FieldExtractionStats) => {
			const missingCount = stat.totalAttempts - stat.successCount;
			console.log(
				`   • ${missingCount} item(s) missing required field: ${stat.fieldName}`,
			);
		});

		summary.errors.forEach((error: string) => {
			console.log(`   • ${error}`);
		});
	}

	// Timing
	console.log(`\n⏱️  Crawl took: ${duration} seconds`);
}
