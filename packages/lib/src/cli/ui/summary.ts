import type { FieldExtractionStats, ProcessingSummaryResult } from "@/index.js";

export function displayCrawlSummary(result: ProcessingSummaryResult): void {
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
		console.log(`   • Listing pages processed: ${summary.pagesProcessed}`);

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
				process_interrupted: "process was interrupted",
			};
			console.log(`   • Stop reason: ${reasonMessages[summary.stoppedReason]}`);
		}
	}

	// Field extraction stats
	console.log("\n📋 Listing field extraction stats:");
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

	// Content field extraction stats
	const contentStats = summary.contentFieldStats;
	if (contentStats && contentStats.length > 0) {
		console.log("\n🔍 Content field extraction stats:");
		contentStats.forEach((stat: FieldExtractionStats) => {
			const percentage =
				stat.totalAttempts > 0
					? Math.round((stat.successCount / stat.totalAttempts) * 100)
					: 0;

			console.log(
				`   • ${stat.fieldName}: ${stat.successCount}/${stat.totalAttempts} (${percentage}%)`,
			);
		});
	}

	// Only show issues for required fields or actual errors
	const requiredFieldIssues = summary.fieldStats.filter(
		(stat: FieldExtractionStats) =>
			!stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	// Check for content extraction errors (support both new and legacy)
	const contentErrorsForCheck = summary.contentErrors;
	const hasContentErrors =
		contentErrorsForCheck && contentErrorsForCheck.length > 0;

	if (
		requiredFieldIssues.length > 0 ||
		summary.listingErrors.length > 0 ||
		hasContentErrors
	) {
		console.log("\n⚠️  Issues found:");

		// Listing issues
		if (requiredFieldIssues.length > 0 || summary.listingErrors.length > 0) {
			console.log("   📋 Listing extraction issues:");

			requiredFieldIssues.forEach((stat: FieldExtractionStats) => {
				const missingCount = stat.totalAttempts - stat.successCount;
				console.log(
					`      • ${missingCount} item(s) missing required field: ${stat.fieldName}`,
				);
			});

			summary.listingErrors.forEach((error: string) => {
				console.log(`      • ${error}`);
			});
		}

		// Content extraction issues
		const contentErrors = summary.contentErrors; // Support both new and legacy
		const hasContentErrors = contentErrors && contentErrors.length > 0;
		if (hasContentErrors) {
			console.log("   🔍 Content extraction issues:");
			console.log(
				`      • ${contentErrors?.length} content page(s) had extraction errors`,
			);
			// Show first few content errors as examples
			contentErrors?.slice(0, 3).forEach((error: string) => {
				console.log(`        - ${error}`);
			});
			if (contentErrors && contentErrors.length > 3) {
				console.log(`        ... and ${contentErrors.length - 3} more`);
			}
		}
	}

	// Storage stats
	if (summary.storageStats && summary.storageStats.itemsStored > 0) {
		console.log(`\n💾 Storage:`);
		console.log(`   • Items stored: ${summary.storageStats.itemsStored}`);
		if (summary.storageStats.itemsFailed > 0) {
			console.log(
				`   • Items failed to store: ${summary.storageStats.itemsFailed}`,
			);
		}
	}

	// Timing
	console.log(`\n⏱️  Crawl took: ${duration} seconds`);
}
