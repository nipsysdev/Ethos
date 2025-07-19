import { spawn } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessingResult } from "../../index.js";
import { formatDataForViewing } from "./formatter.js";

function cleanupTempFile(filePath: string): void {
	try {
		unlinkSync(filePath);
	} catch {
		// Ignore cleanup errors - file might not exist or be locked
	}
}

export async function showExtractedData(
	result: ProcessingResult,
): Promise<void> {
	const { data, summary } = result;

	if (data.length === 0) {
		console.log("No data to display.");
		return;
	}

	// Format the data for display
	const formattedData = formatDataForViewing(data, summary);

	// Create a temporary file
	const tempFile = join(tmpdir(), `ethos-crawl-${Date.now()}.txt`);

	try {
		writeFileSync(tempFile, formattedData, "utf8");

		// Open with less
		const less = spawn("less", ["-R", tempFile], {
			stdio: "inherit",
		});

		await new Promise<void>((resolve, reject) => {
			less.on("close", (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`less exited with code ${code}`));
				}
			});

			less.on("error", (err) => {
				console.error("Error opening less viewer:", err.message);
				console.log("Displaying data directly:");
				console.log(formattedData);
				resolve();
			});
		});
	} catch (error) {
		console.error(
			"Could not create temp file:",
			error instanceof Error ? error.message : error,
		);
		console.log("Displaying data directly:");
		console.log(formattedData);
	} finally {
		// Clean up temp file
		cleanupTempFile(tempFile);
	}
}
