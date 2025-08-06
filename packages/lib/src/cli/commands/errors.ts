import { spawn } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessingSummaryResult } from "@/index.js";

/**
 * Display all crawling errors in a less interface
 */
export async function showCrawlErrors(
	result: ProcessingSummaryResult,
): Promise<void> {
	const { summary } = result;
	const { listingErrors, contentErrors, fieldStats } = summary;

	// Check for required field issues
	const requiredFieldIssues = fieldStats.filter(
		(stat) => !stat.isOptional && stat.successCount < stat.totalAttempts,
	);

	// Check if there are any errors to display
	const hasListingErrors = listingErrors && listingErrors.length > 0;
	const hasContentErrors = contentErrors && contentErrors.length > 0;
	const hasFieldIssues = requiredFieldIssues.length > 0;

	if (!hasListingErrors && !hasContentErrors && !hasFieldIssues) {
		console.log("✅ No errors found during crawling!");
		console.log("Press Enter to continue...");
		await new Promise<void>((resolve) => {
			process.stdin.once("data", () => resolve());
		});
		return;
	}

	// Generate error content
	let errorContent = "";
	errorContent += `Crawling Errors Report for ${summary.sourceName} (${summary.sourceId})\n`;
	errorContent += `Generated: ${new Date().toISOString()}\n\n`;

	if (hasListingErrors || hasFieldIssues) {
		errorContent +=
			"═══════════════════════════════════════════════════════════════\n";
		errorContent += "📋 LISTING EXTRACTION ERRORS\n";
		errorContent +=
			"═══════════════════════════════════════════════════════════════\n\n";

		// Add required field issues
		if (hasFieldIssues) {
			errorContent += "Required Field Extraction Issues:\n\n";
			requiredFieldIssues.forEach((stat, index) => {
				const missingCount = stat.totalAttempts - stat.successCount;
				errorContent += `${index + 1}. ${missingCount} item(s) missing required field: ${stat.fieldName}\n\n`;
			});
		}

		// Add listing errors
		if (hasListingErrors) {
			const startIndex = hasFieldIssues ? requiredFieldIssues.length + 1 : 1;
			if (hasFieldIssues) {
				errorContent += "General Listing Errors:\n\n";
			}
			listingErrors.forEach((error, index) => {
				errorContent += `${startIndex + index}. ${error}\n\n`;
			});
		}
	}

	if (hasContentErrors) {
		errorContent +=
			"═══════════════════════════════════════════════════════════════\n";
		errorContent += "🔍 CONTENT EXTRACTION ERRORS\n";
		errorContent +=
			"═══════════════════════════════════════════════════════════════\n\n";

		contentErrors.forEach((error, index) => {
			errorContent += `${index + 1}. ${error}\n\n`;
		});
	}

	errorContent +=
		"═══════════════════════════════════════════════════════════════\n";
	errorContent += "📊 SUMMARY\n";
	errorContent +=
		"═══════════════════════════════════════════════════════════════\n\n";
	errorContent += `Total field extraction issues: ${requiredFieldIssues.length}\n`;
	errorContent += `Total listing errors: ${listingErrors?.length || 0}\n`;
	errorContent += `Total content errors: ${contentErrors?.length || 0}\n`;
	errorContent += `Total errors: ${requiredFieldIssues.length + (listingErrors?.length || 0) + (contentErrors?.length || 0)}\n\n`;
	errorContent += "Use 'q' to quit, arrow keys to navigate, '/' to search\n";

	// Create temporary file
	const tempFile = join(tmpdir(), `ethos-crawl-errors-${Date.now()}.txt`);

	try {
		writeFileSync(tempFile, errorContent, "utf8");

		// Launch less with the temporary file
		await new Promise<void>((resolve, reject) => {
			const lessProcess = spawn("less", ["-R", "-S", tempFile], {
				stdio: "inherit",
			});

			lessProcess.on("close", (code) => {
				if (code === 0 || code === null) {
					resolve();
				} else {
					reject(new Error(`less exited with code ${code}`));
				}
			});

			lessProcess.on("error", (error) => {
				reject(error);
			});
		});
	} catch (error) {
		console.error("Error displaying errors:", error);
		console.log("\nFalling back to console output:\n");
		console.log(errorContent);
		console.log("Press Enter to continue...");
		await new Promise<void>((resolve) => {
			process.stdin.once("data", () => resolve());
		});
	} finally {
		// Clean up temporary file
		try {
			unlinkSync(tempFile);
		} catch {
			// Ignore cleanup errors
		}
	}
}
