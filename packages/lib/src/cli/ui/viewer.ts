import { spawn } from "node:child_process";
import { join } from "node:path";
import type { CrawlMetadata, CrawlMetadataItem } from "@/core/types.js";
import type { ProcessingResult } from "@/index.js";
import { ContentStore } from "@/storage/ContentStore.js";
import { MetadataStore } from "@/storage/MetadataStore.js";

async function isLessAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		// Use appropriate command based on platform
		const isWindows = process.platform === "win32";
		const command = isWindows ? "where" : "which";
		const args = ["less"];

		const testProcess = spawn(command, args, {
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

export async function showExtractedData(
	result: ProcessingResult,
): Promise<void> {
	const inquirer = (await import("inquirer")).default;

	// Check if we have session ID for accessing crawl data
	if (!result.summary.sessionId) {
		console.log("No crawl session available for viewing.");
		return;
	}

	// Get crawl metadata from database
	const metadataStore = new MetadataStore();
	let crawlMetadata: CrawlMetadata;

	try {
		const session = metadataStore.getSession(result.summary.sessionId);
		if (!session) {
			console.log("Crawl session not found.");
			return;
		}

		crawlMetadata = JSON.parse(session.metadata);
	} catch (error) {
		console.log("Could not read crawl session data.");
		console.error("Error:", error);
		return;
	} finally {
		metadataStore.close();
	}

	// Use itemsForViewer from metadata to create file choices
	const storedItems = crawlMetadata.itemsForViewer || [];

	if (storedItems.length === 0) {
		console.log("No stored files found.");
		return;
	}

	// Create a ContentStore instance to get the storage directory
	const contentStore = new ContentStore();
	const storageDir = contentStore.getStorageDirectory();

	// Create choices with titles and file info
	const choices = storedItems.map((item: CrawlMetadataItem, index: number) => {
		const publishedInfo = item.publishedDate
			? ` (${new Date(item.publishedDate).toLocaleDateString()})`
			: "";
		return {
			name: `${index + 1}. ${item.title}${publishedInfo}`,
			value: join(storageDir, `${item.hash}.json`),
			short: item.title,
		};
	});

	choices.push({
		name: "← Back to menu",
		value: "back",
		short: "Back",
	});

	const { selectedFile } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedFile",
			message: `Select an item to view (${storedItems.length} files):`,
			choices,
			pageSize: 15,
		},
	]);

	if (selectedFile === "back") {
		return;
	}

	try {
		if (await isLessAvailable()) {
			const less = spawn("less", ["-R", selectedFile], {
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
					reject(err);
				});
			});
		} else {
			console.log(
				"Less viewer not available. Please install 'less' to view files.",
			);
			console.log(`File location: ${selectedFile}`);
		}
	} catch (error) {
		console.error(
			"Error viewing file:",
			error instanceof Error ? error.message : error,
		);
	}

	// Loop back to file selection
	await showExtractedData(result);
}
