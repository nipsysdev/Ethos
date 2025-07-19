import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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

async function isLessAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const testProcess = spawn("which", ["less"], {
			stdio: "ignore",
		});
		testProcess.on("close", (code) => {
			resolve(code === 0);
		});
		testProcess.on("error", () => {
			resolve(false);
		});
	});
}

async function handleLessProcess(
	less: ReturnType<typeof spawn>,
	formattedData: string,
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
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

	// Create a temporary file with unique identifier
	const tempFile = join(tmpdir(), `ethos-crawl-${randomUUID()}.txt`);

	try {
		writeFileSync(tempFile, formattedData, "utf8");

		// Check if less is available before trying to use it
		const lessAvailable = await isLessAvailable();
		if (!lessAvailable) {
			console.log("Less viewer not available. Displaying data directly:");
			console.log(formattedData);
			return;
		}

		// Open with less
		const less = spawn("less", ["-R", tempFile], {
			stdio: "inherit",
		});

		await handleLessProcess(less, formattedData);
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
