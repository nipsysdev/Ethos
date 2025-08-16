import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ProcessingSummaryResult } from "@/core/ProcessingPipeline";
import { ContentStore } from "@/storage/ContentStore";
import type { MetadataStore } from "@/storage/MetadataStore";
import { MENU_LABELS, NAV_VALUES } from "@/ui/constants";

const ITEMS_PER_PAGE = 50;
const MAX_VISIBLE_MENU_OPTIONS = 20;

const NAV_PREVIOUS = "prev";
const NAV_NEXT = "next";
const NAV_SEPARATOR = "separator";

const DISPLAY_PREVIOUS_PREFIX = "<< Previous page";
const DISPLAY_NEXT_SUFFIX = ">>";
const SEPARATOR_LINE = "-".repeat(50);

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
	metadataStoreFactory: () => MetadataStore,
): Promise<void> {
	if (!result.summary.sessionId) {
		console.log("No crawl session available for viewing.");
		return;
	}

	const metadataStore = metadataStoreFactory();

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

	await showPaginatedViewer(storedItems, result, metadataStoreFactory);
}

async function showPaginatedViewer(
	items: Array<{
		title: string;
		hash: string;
		publishedDate?: Date;
		url: string;
	}>,
	result: ProcessingSummaryResult,
	metadataStoreFactory: () => MetadataStore,
	currentPage = 0,
): Promise<void> {
	const inquirer = (await import("inquirer")).default;
	const pageSize = ITEMS_PER_PAGE;
	const totalPages = Math.ceil(items.length / pageSize);
	const startIndex = currentPage * pageSize;
	const endIndex = Math.min(startIndex + pageSize, items.length);
	const currentItems = items.slice(startIndex, endIndex);

	const contentStoreFactory = () => new ContentStore({ enableMetadata: false });
	const contentStore = contentStoreFactory();
	const storageDir = contentStore.getStorageDirectory();

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

	const navigationChoices = [];

	if (currentPage > 0) {
		navigationChoices.push({
			name: `${DISPLAY_PREVIOUS_PREFIX} (${currentPage}/${totalPages})`,
			value: NAV_PREVIOUS,
			short: "Previous",
		});
	}

	if (currentPage < totalPages - 1) {
		navigationChoices.push({
			name: `Next page (${currentPage + 2}/${totalPages}) ${DISPLAY_NEXT_SUFFIX}`,
			value: NAV_NEXT,
			short: "Next",
		});
	}

	if (totalPages > 1) {
		choices.push({
			name: SEPARATOR_LINE,
			value: NAV_SEPARATOR,
			disabled: true,
		} as never);
		choices.push(...navigationChoices);
	}

	choices.push({
		name: MENU_LABELS.BACK_TO_MENU,
		value: NAV_VALUES.BACK,
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
			pageSize: Math.min(MAX_VISIBLE_MENU_OPTIONS, choices.length), // Limit visible options
		},
	]);

	if (selectedFile === NAV_VALUES.BACK) {
		return;
	}

	if (selectedFile === NAV_PREVIOUS) {
		await showPaginatedViewer(
			items,
			result,
			metadataStoreFactory,
			currentPage - 1,
		);
		return;
	}

	if (selectedFile === NAV_NEXT) {
		await showPaginatedViewer(
			items,
			result,
			metadataStoreFactory,
			currentPage + 1,
		);
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

	await showPaginatedViewer(items, result, metadataStoreFactory, currentPage);
}
