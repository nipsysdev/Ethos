import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ProcessingSummaryResult } from "@/index.js";
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
	result: ProcessingSummaryResult,
): Promise<void> {
	// Check if we have session ID for accessing crawl data
	if (!result.summary.sessionId) {
		console.log("No crawl session available for viewing.");
		return;
	}

	// Get content items from junction table
	const metadataStore = new MetadataStore();

	interface ViewerItem {
		title: string;
		hash: string;
		publishedDate?: Date;
		url: string;
	}

	let storedItems: ViewerItem[] = [];

	try {
		const sessionContents = metadataStore.getSessionContents(
			result.summary.sessionId,
		);

		if (sessionContents.length === 0) {
			console.log("No stored files found.");
			return;
		}

		// Transform junction table data to match expected format
		storedItems = sessionContents.map((content) => ({
			title: content.title,
			hash: content.hash,
			publishedDate: content.publishedDate,
			url: content.url,
		}));
	} catch (error) {
		console.log("Could not read crawl session data.");
		console.error("Error:", error instanceof Error ? error.message : error);
		return;
	} finally {
		metadataStore.close();
	}

	// Use pagination for large datasets
	await showPaginatedViewer(storedItems, result);
}

async function showPaginatedViewer(
	items: Array<{
		title: string;
		hash: string;
		publishedDate?: Date;
		url: string;
	}>,
	result: ProcessingSummaryResult,
	currentPage = 0,
): Promise<void> {
	const inquirer = (await import("inquirer")).default;
	const pageSize = 50; // Show 50 items per page
	const totalPages = Math.ceil(items.length / pageSize);
	const startIndex = currentPage * pageSize;
	const endIndex = Math.min(startIndex + pageSize, items.length);
	const currentItems = items.slice(startIndex, endIndex);

	// Create a ContentStore instance to get the storage directory
	const contentStore = new ContentStore({ enableMetadata: false });
	const storageDir = contentStore.getStorageDirectory();

	// Create choices for current page items
	const choices = currentItems.map((item, index) => {
		const globalIndex = startIndex + index + 1;
		const publishedInfo = item.publishedDate
			? ` (${new Date(item.publishedDate).toLocaleDateString()})`
			: "";
		return {
			name: `${globalIndex}. ${item.title}${publishedInfo}`,
			value: join(storageDir, `${item.hash}.json`),
			short: item.title,
		};
	});

	// Add navigation options
	const navigationChoices = [];

	if (currentPage > 0) {
		navigationChoices.push({
			name: `← Previous page (${currentPage}/${totalPages})`,
			value: "prev",
			short: "Previous",
		});
	}

	if (currentPage < totalPages - 1) {
		navigationChoices.push({
			name: `Next page (${currentPage + 2}/${totalPages}) →`,
			value: "next",
			short: "Next",
		});
	}

	// Add separator and navigation if there are multiple pages
	if (totalPages > 1) {
		choices.push({
			name: "─".repeat(50),
			value: "separator",
			disabled: true,
		} as never);
		choices.push(...navigationChoices);
	}

	choices.push({
		name: "← Back to menu",
		value: "back",
		short: "Back",
	});

	const pageInfo =
		totalPages > 1 ? ` (Page ${currentPage + 1}/${totalPages})` : "";
	const { selectedFile } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedFile",
			message: `Select an item to view${pageInfo} - ${items.length} total items:`,
			choices,
			pageSize: Math.min(20, choices.length), // Limit visible options
		},
	]);

	if (selectedFile === "back") {
		return;
	}

	if (selectedFile === "prev") {
		await showPaginatedViewer(items, result, currentPage - 1);
		return;
	}

	if (selectedFile === "next") {
		await showPaginatedViewer(items, result, currentPage + 1);
		return;
	}

	// View the selected file
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

	// Return to the same page after viewing
	await showPaginatedViewer(items, result, currentPage);
}
