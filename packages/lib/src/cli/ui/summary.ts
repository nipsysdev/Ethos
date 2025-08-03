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
			};
			console.log(`   • Stop reason: ${reasonMessages[summary.stoppedReason]}`);
		}
	}

	// Detail crawling stats (if available)
	if (summary.detailsSkipped && summary.detailsSkipped > 0) {
		console.log(`   • Detail pages skipped: ${summary.detailsSkipped}`);
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

	// Detail field extraction stats (if detail crawling was performed)
	if (summary.detailFieldStats && summary.detailFieldStats.length > 0) {
		console.log("\n🔍 Detail field extraction stats:");
		summary.detailFieldStats.forEach((stat: FieldExtractionStats) => {
			const percentage =
				stat.totalAttempts > 0
					? Math.round((stat.successCount / stat.totalAttempts) * 100)
					: 0;
			const optionalLabel = stat.isOptional ? " (optional)" : "";

			console.log(
				`   • ${stat.fieldName}: ${stat.successCount}/${stat.totalAttempts} (${percentage}%)${optionalLabel}`,
			);
		});
	}

	// Only show issues for required fields or actual errors
	const requiredFieldIssues = summary.fieldStats.filter(
		(stat: FieldExtractionStats) =>
			!stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	const hasDetailErrors =
		summary.detailErrors && summary.detailErrors.length > 0;

	if (
		requiredFieldIssues.length > 0 ||
		summary.listingErrors.length > 0 ||
		hasDetailErrors
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

		// Detail issues
		if (hasDetailErrors) {
			console.log("   🔍 Detail extraction issues:");
			console.log(
				`      • ${summary.detailErrors?.length} detail page(s) had extraction errors`,
			);
			// Show first few detail errors as examples
			summary.detailErrors?.slice(0, 3).forEach((error: string) => {
				console.log(`        - ${error}`);
			});
			if (summary.detailErrors && summary.detailErrors.length > 3) {
				console.log(`        ... and ${summary.detailErrors.length - 3} more`);
			}
		}
	}

	// Storage stats
	const storedItems = result.data.filter((item) => item.storage).length;
	if (storedItems > 0) {
		console.log(`\n💾 Storage:`);
		console.log(`   • Items stored: ${storedItems}`);
		if (storedItems < result.data.length) {
			console.log(
				`   • Items failed to store: ${result.data.length - storedItems}`,
			);
		}
	}

	// Timing
	console.log(`\n⏱️  Crawl took: ${duration} seconds`);
}
