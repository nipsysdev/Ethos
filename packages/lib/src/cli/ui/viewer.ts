import { spawn } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessingResult } from "../../index.js";
import { formatDataForViewing } from "./formatter.js";

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

			less.on("error", (_err) => {
				console.log("Could not open less viewer. Displaying data directly:");
				console.log(formattedData);
				resolve();
			});
		});
	} catch (_error) {
		console.log("Could not create temp file. Displaying data directly:");
		console.log(formattedData);
	} finally {
		// Clean up temp file
		try {
			unlinkSync(tempFile);
		} catch {
			// Ignore cleanup errors
		}
	}
}
