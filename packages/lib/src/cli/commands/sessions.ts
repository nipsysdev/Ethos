import type { CrawlMetadata } from "@/core/types.js";
import type {
	FieldExtractionStats,
	ProcessingPipeline,
	ProcessingSummaryResult,
} from "@/index.js";
import type {
	ContentMetadata,
	CrawlSession,
	MetadataStore,
} from "@/storage/index.js";
import {
	ERROR_MESSAGES,
	FIELD_NAMES,
	MENU_LABELS,
	NAV_VALUES,
	PROMPT_MESSAGES,
} from "../constants.js";
import { createDataViewChoices } from "../ui/menus.js";
import { displayCrawlSummary } from "../ui/summary.js";
import { checkMetadataStore } from "../utils.js";

/**
 * Handle the sessions browsing command
 */
export async function handleSessions(
	pipeline: ProcessingPipeline,
): Promise<"main" | "exit"> {
	const inquirer = (await import("inquirer")).default;

	try {
		const storeCheck = checkMetadataStore(pipeline);
		if (storeCheck.error) {
			return NAV_VALUES.MAIN;
		}
		const { metadataStore } = storeCheck;

		// Get all sessions with basic info only
		const allSessions = await getAllSessions(metadataStore);

		if (allSessions.length === 0) {
			console.log(ERROR_MESSAGES.NO_SESSIONS_FOUND);
			return NAV_VALUES.MAIN;
		}

		// Directly show the sessions list for selection
		while (true) {
			const { selectedSessionId } = await inquirer.prompt([
				{
					type: "list",
					name: FIELD_NAMES.SELECTED_SESSION_ID,
					message: `${PROMPT_MESSAGES.SELECT_CRAWL_SESSION} (${allSessions.length} available):`,
					choices: [
						...allSessions.map((session) => {
							const duration = session.endTime
								? `${Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)}s`
								: "Active";

							return {
								name: `${session.sourceName} - ${session.startTime.toLocaleDateString()} ${session.startTime.toLocaleTimeString()} (${duration})`,
								value: session.id,
							};
						}),
						{
							name: MENU_LABELS.BACK_TO_MAIN,
							value: NAV_VALUES.BACK,
						},
					],
				},
			]);

			if (selectedSessionId === NAV_VALUES.BACK) {
				return NAV_VALUES.MAIN;
			}

			// Create a ProcessingSummaryResult from the session and show the post-crawl menu
			const sessionResult = await createSessionSummaryResult(
				selectedSessionId,
				metadataStore,
			);
			if (sessionResult) {
				// Display the full summary with statistics
				displayCrawlSummary(sessionResult);

				// Show session-specific menu and handle actions
				while (true) {
					const action = await showSessionMenu(sessionResult);
					if (action === "main") {
						return "main";
					}
					if (action === "sessions") {
						break; // Go back to sessions list
					}
					if (action === "view") {
						// Import and show the data viewer
						const { showExtractedData } = await import("../ui/viewer.js");
						await showExtractedData(sessionResult);
						// After viewing, show the summary again and continue the session menu loop
						displayCrawlSummary(sessionResult);
						continue;
					}
					if (action === "errors") {
						// Import and show the errors viewer
						const { showCrawlErrors } = await import("./errors.js");
						await showCrawlErrors(sessionResult);
						// After viewing errors, show the summary again and continue the session menu loop
						displayCrawlSummary(sessionResult);
					}
				}
			}
		}
	} catch (error) {
		console.error("Error browsing sessions:", error);
		return "main";
	}
}

/**
 * Get all sessions from the metadata store
 */
async function getAllSessions(
	metadataStore: MetadataStore,
): Promise<CrawlSession[]> {
	try {
		return metadataStore.getAllSessions();
	} catch (error) {
		console.warn("Could not retrieve sessions:", error);
		return [];
	}
}

/**
 * Create a ProcessingSummaryResult from a session for use with the post-crawl UI
 */
async function createSessionSummaryResult(
	sessionId: string,
	metadataStore: MetadataStore,
): Promise<ProcessingSummaryResult | null> {
	try {
		const session = metadataStore.getSession(sessionId);
		if (!session) {
			console.log(`Error: Session ${sessionId} not found`);
			return null;
		}

		const contents = metadataStore.getSessionContents(sessionId);
		const errorCount = contents.filter(
			(c) => c.hadContentExtractionError,
		).length;
		const successCount = contents.length - errorCount;

		// Parse the stored metadata to get pagesProcessed and other data
		let storedMetadata: Partial<CrawlMetadata> = {};
		try {
			storedMetadata = JSON.parse(session.metadata) as CrawlMetadata;
		} catch (error) {
			console.warn("Could not parse session metadata:", error);
		}

		// Calculate field extraction statistics based on actual content
		const fieldStats = calculateFieldStats(contents);
		const contentFieldStats = calculateContentFieldStats(contents);

		// Create a summary that matches the CrawlSummary interface
		const summary = {
			sourceId: session.sourceId,
			sourceName: session.sourceName,
			itemsFound: contents.length,
			itemsProcessed: contents.length,
			itemsWithErrors: errorCount,
			fieldStats: fieldStats, // Use calculated field stats
			contentFieldStats: contentFieldStats, // Use calculated content field stats
			listingErrors: storedMetadata.listingErrors || [],
			startTime: session.startTime,
			endTime: session.endTime || new Date(),
			pagesProcessed: storedMetadata.pagesProcessed || 0,
			duplicatesSkipped: storedMetadata.duplicatesSkipped || 0,
			urlsExcluded: storedMetadata.urlsExcluded || 0,
			contentsCrawled: successCount,
			contentErrors: contents
				.filter((c) => c.hadContentExtractionError)
				.map((c) => `${c.url}: Content extraction failed`),
			sessionId: session.id,
			storageStats: {
				itemsStored: successCount,
				itemsFailed: errorCount,
				totalItems: contents.length,
			},
		};

		return { summary };
	} catch (error) {
		console.error("Error creating session summary:", error);
		return null;
	}
}

/**
 * Show a session-specific menu with relevant options only
 */
async function showSessionMenu(
	result: ProcessingSummaryResult,
): Promise<"main" | "sessions" | "view" | "errors"> {
	const inquirer = (await import("inquirer")).default;

	const choices = await createDataViewChoices(result.summary, undefined, [
		{ name: "Back to sessions list", value: "sessions" },
		{ name: "Return to main menu", value: "main" },
	]);

	const { action } = await inquirer.prompt([
		{
			type: "list",
			name: "action",
			message: "What would you like to do next:",
			choices,
		},
	]);

	return action;
}

/**
 * Calculate field extraction statistics from stored content metadata
 */
function calculateFieldStats(
	contents: Array<ContentMetadata & { hadContentExtractionError: boolean }>,
): FieldExtractionStats[] {
	if (contents.length === 0) return [];

	// Common fields that are tracked
	const fields = [
		{ name: "title", isOptional: false },
		{ name: "url", isOptional: false },
		{ name: "author", isOptional: true },
		{ name: "publishedDate", isOptional: true },
	];

	return fields.map((field) => {
		const missingItems: number[] = [];
		const successCount = contents.filter((content, index) => {
			const value = content[field.name as keyof ContentMetadata];
			const hasValue = value !== null && value !== undefined && value !== "";
			if (!hasValue) {
				missingItems.push(index);
			}
			return hasValue;
		}).length;

		return {
			fieldName: field.name,
			successCount,
			totalAttempts: contents.length,
			isOptional: field.isOptional,
			missingItems,
		};
	});
}

/**
 * Calculate content field extraction statistics (simplified for stored sessions)
 */
function calculateContentFieldStats(
	contents: Array<ContentMetadata & { hadContentExtractionError: boolean }>,
): FieldExtractionStats[] {
	// For sessions, we mainly track content extraction success/failure
	if (contents.length === 0) return [];

	const missingItems: number[] = [];
	const successCount = contents.filter((content, index) => {
		const hasContent = !content.hadContentExtractionError;
		if (!hasContent) {
			missingItems.push(index);
		}
		return hasContent;
	}).length;

	return [
		{
			fieldName: "content",
			successCount,
			totalAttempts: contents.length,
			isOptional: false,
			missingItems,
		},
	];
}
