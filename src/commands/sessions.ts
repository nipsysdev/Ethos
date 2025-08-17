import type {
	ProcessingPipeline,
	ProcessingSummaryResult,
} from "@/core/ProcessingPipeline";
import type { CrawlMetadata, FieldExtractionStats } from "@/core/types";
import type {
	ContentMetadata,
	CrawlSession,
	MetadataStore,
} from "@/storage/index";
import {
	ERROR_MESSAGES,
	FIELD_NAMES,
	MENU_LABELS,
	NAV_VALUES,
	PROMPT_MESSAGES,
} from "@/ui/constants";
import { createDataViewChoices } from "@/ui/menus";
import { displayCrawlSummary } from "@/ui/summary";
import { showExtractedData } from "@/ui/viewer";
import { buildCrawlSummary } from "@/utils/summaryBuilder";
import { showCrawlErrors } from "./errors";

export async function handleSessions(
	pipeline: ProcessingPipeline,
): Promise<"main" | "exit"> {
	const inquirer = (await import("inquirer")).default;

	try {
		const metadataStore = pipeline.getMetadataStore();
		if (!metadataStore) return NAV_VALUES.MAIN;

		const allSessions = await getAllSessions(metadataStore);

		if (allSessions.length === 0) {
			console.log(ERROR_MESSAGES.NO_SESSIONS_FOUND);
			return NAV_VALUES.MAIN;
		}

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

			const sessionResult = await createSessionSummaryResult(
				selectedSessionId,
				metadataStore,
			);
			if (sessionResult) {
				displayCrawlSummary(sessionResult);

				while (true) {
					const action = await showSessionMenu(sessionResult);
					if (action === "main") {
						return "main";
					}
					if (action === "sessions") {
						break;
					}
					if (action === "view") {
						await showExtractedData(sessionResult, metadataStore);
						// After viewing, show the summary again and continue the session menu loop
						displayCrawlSummary(sessionResult);
						continue;
					}
					if (action === "errors") {
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

		let storedMetadata: Partial<CrawlMetadata> = {};
		try {
			storedMetadata = JSON.parse(session.metadata) as CrawlMetadata;
		} catch (error) {
			console.warn("Could not parse session metadata:", error);
		}

		const fieldStats = calculateFieldStats(contents);
		const contentFieldStats = calculateContentFieldStats(contents);

		const completeMetadata: CrawlMetadata = {
			duplicatesSkipped: storedMetadata.duplicatesSkipped || 0,
			urlsExcluded: storedMetadata.urlsExcluded || 0,
			totalFilteredItems: storedMetadata.totalFilteredItems || 0,
			itemsProcessed: contents.length,
			pagesProcessed: storedMetadata.pagesProcessed || 0,
			contentsCrawled: successCount,
			fieldStats: fieldStats,
			contentFieldStats: contentFieldStats,
			listingErrors: storedMetadata.listingErrors || [],
			contentErrors: storedMetadata.contentErrors || [],
			stoppedReason: storedMetadata.stoppedReason,
		};

		const summary = buildCrawlSummary(
			{
				sourceId: session.sourceId,
				sourceName: session.sourceName,
				startTime: session.startTime,
				endTime: session.endTime,
				sessionId: sessionId, // Use the parameter instead of session.id
			},
			completeMetadata,
			{
				itemsWithErrors: errorCount,
				storageStats: {
					itemsStored: successCount,
					itemsFailed: errorCount,
					totalItems: contents.length,
				},
			},
		);

		return { summary };
	} catch (error) {
		console.error("Error creating session summary:", error);
		return null;
	}
}

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

function calculateFieldStats(
	contents: Array<ContentMetadata & { hadContentExtractionError: boolean }>,
): FieldExtractionStats[] {
	if (contents.length === 0) return [];

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
